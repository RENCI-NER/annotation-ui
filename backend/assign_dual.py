"""
Smart article assignment for dual-annotator inter-annotator agreement.

Ensures each article is reviewed by exactly 2 annotators. When assigning
to a new annotator, prioritizes articles that already have 1 annotator
(needing a second) before assigning fresh ones.

Supports random sampling from large corpus files so the review queue is
representative rather than sequential.

Usage:
    # Assign 50 articles to alice (prefers articles needing a 2nd annotator)
    python assign_dual.py alice 50

    # Load a random sample from a large corpus, then assign
    python assign_dual.py alice 50 --load /path/to/large_corpus.json --sample 200

    # Dry run — show what would be assigned without writing
    python assign_dual.py alice 50 --dry-run

    # Show current assignment stats
    python assign_dual.py --stats
"""

import argparse
import json
import random
import sys
from collections import Counter, defaultdict
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

TARGET_ANNOTATORS_PER_ARTICLE = 2


def get_assignment_stats(db):
    """Get a summary of the current assignment state."""
    assignments = db.query(models.ArticleAssignment).all()
    total_articles = db.query(models.Article).count()

    article_annotators = defaultdict(set)
    for a in assignments:
        article_annotators[a.pmid].add(a.annotator)

    zero_annotators = total_articles - len(article_annotators)
    one_annotator = sum(1 for s in article_annotators.values() if len(s) == 1)
    two_plus = sum(1 for s in article_annotators.values() if len(s) >= 2)

    annotator_counts = Counter()
    for a in assignments:
        annotator_counts[a.annotator] += 1

    return {
        "total_articles": total_articles,
        "zero_annotators": zero_annotators,
        "one_annotator": one_annotator,
        "two_plus_annotators": two_plus,
        "annotator_counts": annotator_counts,
        "article_annotators": article_annotators,
    }


def load_sample(json_file: str, sample_size: int):
    """Load a random sample of articles from a large corpus JSON file."""
    print(f"Reading {json_file}...")
    with open(json_file, "r") as f:
        articles = json.load(f)

    total = len(articles)
    sample_size = min(sample_size, total)
    print(f"  {total:,} articles in file, sampling {sample_size:,}")

    sampled = random.sample(articles, sample_size)
    return sampled


def find_entity_positions(text: str, entity_text: str):
    start = text.lower().find(entity_text.lower())
    if start == -1:
        return 0, 0
    return start, start + len(entity_text)


def ingest_articles(articles: list, db) -> int:
    """Load articles into the database, skipping duplicates. Returns count added."""
    added = 0
    for article_data in articles:
        pmid = str(article_data.get("pmid", ""))
        if not pmid:
            continue

        existing = db.query(models.Article).filter(models.Article.pmid == pmid).first()
        if existing:
            continue

        title = article_data.get("title", "")
        abstract = article_data.get("abstract", "")
        combined_text = f"{title}: {abstract}" if title else abstract

        article = models.Article(
            pmid=pmid,
            title=title,
            abstract=combined_text,
            year=article_data.get("year"),
            keywords=article_data.get("keywords", []),
            target_entity_count=len(article_data.get("triples", [])),
        )
        db.add(article)
        db.flush()

        for triple_data in article_data.get("triples", []):
            subj_start, subj_end = find_entity_positions(combined_text, triple_data.get("subject", ""))
            subject_entity = models.Entity(
                pmid=pmid,
                text=triple_data.get("subject", ""),
                normalized_id=triple_data.get("subject_id"),
                normalized_label=triple_data.get("subject_label"),
                biolink_types=triple_data.get("subject_types", []),
                start_pos=subj_start,
                end_pos=subj_end,
            )
            db.add(subject_entity)
            db.flush()

            obj_start, obj_end = find_entity_positions(combined_text, triple_data.get("object", ""))
            object_entity = models.Entity(
                pmid=pmid,
                text=triple_data.get("object", ""),
                normalized_id=triple_data.get("object_id"),
                normalized_label=triple_data.get("object_label"),
                biolink_types=triple_data.get("object_types", []),
                start_pos=obj_start,
                end_pos=obj_end,
            )
            db.add(object_entity)
            db.flush()

            distance = abs(subj_start - obj_start)
            triple = models.Triple(
                pmid=pmid,
                subject_id=subject_entity.id,
                object_id=object_entity.id,
                llm_suggestion=triple_data.get("relationship", ""),
                distance_words=distance // 6,
                same_sentence=distance < 200,
            )
            db.add(triple)

        added += 1

    db.commit()
    return added


def assign_to_annotator(annotator: str, num_articles: int, db, dry_run=False) -> dict:
    """
    Assign articles to an annotator with dual-review priority:
    1. First: articles with exactly 1 other annotator (needs 2nd reviewer)
    2. Then: articles with 0 annotators (fresh)
    Never assigns an article to the same annotator twice.
    """
    annotator = annotator.lower().strip()

    already_assigned = set(
        a.pmid for a in db.query(models.ArticleAssignment).filter(
            models.ArticleAssignment.annotator == annotator
        ).all()
    )

    all_assignments = db.query(models.ArticleAssignment).all()
    article_annotators = defaultdict(set)
    for a in all_assignments:
        article_annotators[a.pmid].add(a.annotator)

    all_pmids = set(a.pmid for a in db.query(models.Article).all())

    needs_second = []
    needs_first = []

    for pmid in all_pmids:
        if pmid in already_assigned:
            continue
        annotators = article_annotators.get(pmid, set())
        count = len(annotators)
        if count == 1 and annotator not in annotators:
            needs_second.append(pmid)
        elif count == 0:
            needs_first.append(pmid)

    random.shuffle(needs_second)
    random.shuffle(needs_first)

    to_assign = []
    for pmid in needs_second:
        if len(to_assign) >= num_articles:
            break
        to_assign.append(pmid)

    for pmid in needs_first:
        if len(to_assign) >= num_articles:
            break
        to_assign.append(pmid)

    if not dry_run:
        for pmid in to_assign:
            assignment = models.ArticleAssignment(
                annotator=annotator,
                pmid=pmid,
            )
            db.add(assignment)
        db.commit()

    from_second = sum(1 for p in to_assign if p in set(needs_second))
    from_fresh = len(to_assign) - from_second

    return {
        "annotator": annotator,
        "total_assigned": len(to_assign),
        "from_needs_second": from_second,
        "from_fresh": from_fresh,
        "already_had": len(already_assigned),
    }


def print_stats(db):
    stats = get_assignment_stats(db)
    print(f"\n{'='*60}")
    print(f"  Article Assignment Stats")
    print(f"{'='*60}")
    print(f"\n  Total articles in DB:    {stats['total_articles']:>6,}")
    print(f"  With 0 annotators:       {stats['zero_annotators']:>6,}")
    print(f"  With 1 annotator:        {stats['one_annotator']:>6,}  (needs 2nd)")
    print(f"  With 2+ annotators:      {stats['two_plus_annotators']:>6,}  (complete)")
    print(f"\n  Annotator workloads:")
    for annotator, count in stats["annotator_counts"].most_common():
        completed = sum(
            1 for pmid, anns in stats["article_annotators"].items()
            if annotator in anns and len(anns) >= 2
        )
        print(f"    {annotator:20s}  {count:>4} assigned  ({completed} dual-reviewed)")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Smart dual-annotator article assignment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python assign_dual.py alice 50
  python assign_dual.py bob 50 --load corpus.json --sample 300
  python assign_dual.py --stats
  python assign_dual.py alice 30 --dry-run
        """,
    )
    parser.add_argument("annotator", nargs="?", help="Annotator name")
    parser.add_argument("num", nargs="?", type=int, help="Number of articles to assign")
    parser.add_argument("--load", type=str, help="Path to corpus JSON to load first")
    parser.add_argument("--sample", type=int, default=200, help="How many articles to randomly sample from --load file (default 200)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without writing")
    parser.add_argument("--stats", action="store_true", help="Show assignment stats and exit")

    args = parser.parse_args()
    db = SessionLocal()

    if args.stats:
        print_stats(db)
        db.close()
        return

    if not args.annotator or not args.num:
        parser.print_help()
        sys.exit(1)

    if args.load:
        articles = load_sample(args.load, args.sample)
        added = ingest_articles(articles, db)
        print(f"  Loaded {added} new articles into database ({args.sample - added} already existed)")

    result = assign_to_annotator(args.annotator, args.num, db, dry_run=args.dry_run)

    prefix = "[DRY RUN] " if args.dry_run else ""
    print(f"\n{prefix}Assignment result for '{result['annotator']}':")
    print(f"  Total assigned:     {result['total_assigned']}")
    print(f"    From needs-2nd:   {result['from_needs_second']}  (dual-review priority)")
    print(f"    From fresh:       {result['from_fresh']}  (new articles)")
    print(f"  Already had:        {result['already_had']} prior assignments")

    if not args.dry_run:
        print(f"\n  Done.")
        print_stats(db)

    db.close()


if __name__ == "__main__":
    main()

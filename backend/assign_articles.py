from database import SessionLocal
import models
import sys

def assign_articles(annotator: str, num_articles: int):
    """Assign N unassigned articles to an annotator"""
    db = SessionLocal()
    
    # Get articles that aren't assigned yet
    assigned_pmids = [a.pmid for a in db.query(models.ArticleAssignment).all()]
    
    unassigned = db.query(models.Article).filter(
        ~models.Article.pmid.in_(assigned_pmids)
    ).limit(num_articles).all()
    
    if len(unassigned) == 0:
        print("No unassigned articles available!")
        return
    
    # Create assignments
    for article in unassigned:
        assignment = models.ArticleAssignment(
            annotator=annotator,
            pmid=article.pmid
        )
        db.add(assignment)
    
    db.commit()
    
    print(f"✓ Assigned {len(unassigned)} articles to {annotator}")
    print(f"  PMIDs: {', '.join([a.pmid for a in unassigned[:5]])}...")
    
    db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python assign_articles.py <annotator_name> <num_articles>")
        print("Example: python assign_articles.py alice 100")
        sys.exit(1)
    
    annotator = sys.argv[1]
    num = int(sys.argv[2])
    
    assign_articles(annotator, num)
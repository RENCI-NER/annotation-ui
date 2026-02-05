import { useState, useEffect, useMemo } from 'react';
import yaml from 'js-yaml';

export interface PredicateInfo {
  id: string;
  name: string;
  description: string | null;
}

const BIOLINK_MODEL_URL = 'https://raw.githubusercontent.com/biolink/biolink-model/master/src/biolink_model/schema/biolink_model.yaml'
// https://raw.githubusercontent.com/biolink/biolink-model/master/biolink-model.yaml';

const FALLBACK_PREDICATES = [
  'affects',
  'active_in',
  'actively_involved_in',
  'acts_upstream_of',
  'acts_upstream_of_negative_effect',
  'acts_upstream_of_or_within_negative_effect',
  'acts_upstream_of_or_within_positive_effect',
  'acts_upstream_of_positive_effect',
  'affects_response_to',
  'ameliorates',
  'associated_with',
  'binds',
  'capable_of',
  'catalyzes',
  'causes',
  'coexists_with',
  'coexpressed_with',
  'colocalizes_with',
  'composed_primarily_of',
  'contraindicated_for',
  'contributes_to',
  'correlated_with',
  'decreases_response_to',
  'derives_from',
  'develops_from',
  'directly_physically_interacts_with',
  'disease_has_basis_in',
  'disrupts',
  'expressed_in',
  'gene_associated_with_condition',
  'gene_product_of',
  'genetically_associated_with',
  'genetically_interacts_with',
  'has_adverse_event',
  'has_input',
  'has_output',
  'has_part',
  'has_participant',
  'has_phenotype',
  'homologous_to',
  'in_taxon',
  'increases_response_to',
  'is_frameshift_variant_of',
  'is_missense_variant_of',
  'is_nearby_variant_of',
  'is_non_coding_variant_of',
  'is_nonsense_variant_of',
  'is_splice_site_variant_of',
  'is_synonymous_variant_of',
  'located_in',
  'negatively_correlated_with',
  'occurs_in',
  'overlaps',
  'physically_interacts_with',
  'positively_correlated_with',
  'precedes',
  'produces',
  'regulates',
  'related_to',
  'similar_to',
  'subclass_of',
  'treats'
];

const QUALIFIED_PREDICATES = [
  "affects abundance of",
  "increases abundance of",
  "decreases abundance of",
  "affects activity or abundance of",
  "increases activity or abundance of",
  "decreases activity or abundance of",
  "affects activity of",
  "increases activity of",
  "decreases activity of",
  "affects expression of",
  "increases expression of",
  "decreases expression of",
  "affects folding of",
  "increases folding of",
  "decreases folding of",
  "affects localization of",
  "increases localization of",
  "decreases localization of",
  "affects molecular modification of",
  "increases molecular modification of",
  "decreases molecular modification of",
  "affects metabolic processing of",
  "increases metabolic processing of",
  "decreases metabolic processing of",
  "affects synthesis of",
  "increases synthesis of",
  "decreases synthesis of",
  "affects transport of",
  "increases transport of",
  "decreases transport of",
  "affects degradation of",
  "increases degradation of",
  "increases cleavage",
  "increases hydrolysis",
  "decreases degradation of",
  "decreases cleavage",
  "decreases hydrolysis",
  "affects secretion of",
  "increases secretion of",
  "decreases secretion of",
  "affects mutation rate of",
  "increases mutation rate of",
  "increases mutagenesis",
  "decreases mutation rate of",
  "decreases mutagenesis",
  "affects splicing of",
  "increases splicing of",
  "increases RNA splicing",
  "decreases splicing of",
  "decreases RNA splicing",
  "affects uptake of",
  "increases uptake of",
  "decreases uptake of",
  "affects molecular interaction",
  "increases molecular interaction",
  "decreases molecular interaction",
  "entity negatively regulates entity",
  "entity positively regulates entity",
  "process positively regulates process",
  "process negatively regulates process",
];


const EXCLUDED_DOMAIN_RANGE = ['agent', 'publication', 'information content entity'];
const EXCLUDED_IS_A = ['contributor'];
const EXCLUDED_NAMES = ['related to at concept level', 'related to at instance level'];

function shouldExclude(pred: any): boolean {
  const domain = pred.domain?.toLowerCase() || '';
  const range = pred.range?.toLowerCase() || '';
  const isA = pred.is_a?.toLowerCase() || '';
  const name = pred.name?.toLowerCase() || '';
  
  return EXCLUDED_DOMAIN_RANGE.some(e => domain.includes(e) || range.includes(e)) ||
         EXCLUDED_IS_A.some(e => isA.includes(e)) ||
         EXCLUDED_NAMES.some(e => name.includes(e));
}

export const useBiolinkPredicates = () => {
  const [predicates, setPredicates] = useState<PredicateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredicates = async () => {
      try {
        const response = await fetch(BIOLINK_MODEL_URL, { signal: AbortSignal.timeout(10000) });
        
        if (!response.ok) throw new Error('Failed to fetch');
        
        const yamlText = await response.text();
        const data = yaml.load(yamlText) as any;
        const slots = data?.slots || {};
        const slotNames = Object.keys(slots);
        
        const startIdx = slotNames.indexOf('related to');
        const endIdx = slotNames.indexOf('association slot');
        
        if (startIdx === -1 || endIdx === -1) throw new Error('Invalid range');
        
        const predicateSlots = slotNames.slice(startIdx, endIdx);
        const fetchedPredicates: PredicateInfo[] = [];
        
        for (const slotName of predicateSlots) {
          const info = slots[slotName];
          const pred = {
            name: slotName,
            description: info?.description || null,
            domain: info?.domain || null,
            range: info?.range || null,
            is_a: info?.is_a || null
          };
          
          if (!shouldExclude(pred)) {
            fetchedPredicates.push({
              id: slotName,
              name: slotName,
              description: pred.description
            });
          }
        }
        
        // Add qualified predicates
        QUALIFIED_PREDICATES.forEach(qp => {
          fetchedPredicates.push({
            id: qp,
            name: qp,
            description: null
          });
        });
        
        setPredicates(fetchedPredicates);
        setError(null);
        
      } catch (err) {
        console.error('Failed to fetch Biolink predicates:', err);
        
        // Use fallback
        const fallbackList: PredicateInfo[] = [];
        
        // Add fallback predicates
        FALLBACK_PREDICATES.forEach(fp => {
          fallbackList.push({
            id: fp,
            name: fp,
            description: null
          });
        });
        
        // Add qualified predicates
        QUALIFIED_PREDICATES.forEach(qp => {
          fallbackList.push({
            id: qp,
            name: qp,
            description: null
          });
        });
        
        setPredicates(fallbackList);
        setError('Using fallback predicates');
      } finally {
        setLoading(false);
      }
    };

    fetchPredicates();
  }, []);

  return { predicates, loading, error };
};

// Prioritize exact substring matches from LLM suggestion
export const useSmartPredicateSearch = (
  predicates: PredicateInfo[],
  searchTerm: string,
  llmSuggestion?: string
): PredicateInfo[] => {
  return useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    const suggestion = (llmSuggestion || '').toLowerCase().trim();

    // User is searching - filter by search term
    if (search) {
      return predicates.filter(p => {
        const name = p.name.toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(search) || desc.includes(search);
      });
    }

    // No search but have LLM suggestion - prioritize by relevance
    if (suggestion) {
      // Remove stopwords from suggestion
      const stopwords = new Set(['of', 'the', 'to', 'in', 'with', 'by', 'for', 'on', 'at', 'from', 'a', 'an']);
      const suggestionWords = suggestion
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w));

      const scored = predicates.map(p => {
        const name = p.name.toLowerCase();
        let score = 0;

        // Exact match
        if (name === suggestion) score = 1000;
        // Contains full suggestion
        else if (name.includes(suggestion)) score = 900;
        // Suggestion contains predicate name
        else if (suggestion.includes(name)) score = 800;
        // Count matching words
        else {
          const matchCount = suggestionWords.filter(w => name.includes(w)).length;
          if (matchCount > 0) score = 700 + (matchCount * 50);
        }

        return { predicate: p, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .map(s => s.predicate);
    }

    // No search, no suggestion - return as-is
    return predicates;
  }, [predicates, searchTerm, llmSuggestion]);
};

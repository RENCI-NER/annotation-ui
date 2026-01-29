import { useState, useEffect, useMemo } from 'react';
import yaml from 'js-yaml';

interface PredicateInfo {
  id: string;
  name: string;
  description: string | null ;
  domain?: string | null;
  range?: string | null;
  is_a?: string |null;
}

const FALLBACK_PREDICATES = [
  'biolink:affects',
  'biolink:active_in',
  'biolink:actively_involved_in',
  'biolink:acts_upstream_of',
  'biolink:acts_upstream_of_negative_effect',
  'biolink:acts_upstream_of_or_within_negative_effect',
  'biolink:acts_upstream_of_or_within_positive_effect',
  'biolink:acts_upstream_of_positive_effect',
  'biolink:affects_response_to',
  'biolink:ameliorates',
  'biolink:associated_with',
  'biolink:binds',
  'biolink:capable_of',
  'biolink:catalyzes',
  'biolink:causes',
  'biolink:coexists_with',
  'biolink:coexpressed_with',
  'biolink:colocalizes_with',
  'biolink:composed_primarily_of',
  'biolink:contraindicated_for',
  'biolink:contributes_to',
  'biolink:correlated_with',
  'biolink:decreases_response_to',
  'biolink:derives_from',
  'biolink:develops_from',
  'biolink:directly_physically_interacts_with',
  'biolink:disease_has_basis_in',
  'biolink:disrupts',
  'biolink:expressed_in',
  'biolink:gene_associated_with_condition',
  'biolink:gene_product_of',
  'biolink:genetically_associated_with',
  'biolink:genetically_interacts_with',
  'biolink:has_adverse_event',
  'biolink:has_input',
  'biolink:has_output',
  'biolink:has_part',
  'biolink:has_participant',
  'biolink:has_phenotype',
  'biolink:homologous_to',
  'biolink:in_taxon',
  'biolink:increases_response_to',
  'biolink:is_frameshift_variant_of',
  'biolink:is_missense_variant_of',
  'biolink:is_nearby_variant_of',
  'biolink:is_non_coding_variant_of',
  'biolink:is_nonsense_variant_of',
  'biolink:is_splice_site_variant_of',
  'biolink:is_synonymous_variant_of',
  'biolink:located_in',
  'biolink:negatively_correlated_with',
  'biolink:occurs_in',
  'biolink:overlaps',
  'biolink:physically_interacts_with',
  'biolink:positively_correlated_with',
  'biolink:precedes',
  'biolink:produces',
  'biolink:regulates',
  'biolink:related_to',
  'biolink:similar_to',
  'biolink:subclass_of',
  'biolink:treats'
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


// Excluded domain/range values
const EXCLUDED_DOMAIN_RANGE = [
  'agent',
  'publication',
  'information content entity'
];

// Excluded is_a values
const EXCLUDED_IS_A = [
  'contributor'
];

// Excluded some predicates
const EXCLUDED_PRED = [
  'related to at concept level', 'related to at instance level'
]

// Check if predicate should be excluded
function shouldExcludePredicate(pred: PredicateInfo): boolean {
  // Check domain
  if (pred.domain) {
    const domain = pred.domain.toLowerCase();
    if (EXCLUDED_DOMAIN_RANGE.some(excluded => domain.includes(excluded))) {
      return true;
    }
  }
  
  // Check range
  if (pred.range) {
    const range = pred.range.toLowerCase();
    if (EXCLUDED_DOMAIN_RANGE.some(excluded => range.includes(excluded))) {
      return true;
    }
  }
  
  // Check is_a
  if (pred.is_a) {
    const isA = pred.is_a.toLowerCase();
    if (EXCLUDED_IS_A.some(excluded => isA.includes(excluded))) {
      return true;
    }
  }

  // Check Excluded
  if (pred.name) {
    const name = pred.name.toLowerCase();
    if (EXCLUDED_PRED.some(excluded => name.includes(excluded))) {
      return true;
    }
  }

  return false;
}

// Simple function: check if any word from search appears in predicate name or description
function isRelevant(predicate: PredicateInfo, searchWords: string[]): boolean {
  if (searchWords.length === 0) return false;
  
  const name = predicate.name.toLowerCase();
  const description = predicate.description?.toLowerCase() || '';
  
  // Check if ANY search word appears in name or description
  return searchWords.some(word => 
    name.includes(word) || description.includes(word)
  );
}

// Count how many words match (for sorting relevance)
function countMatches(predicate: PredicateInfo, searchWords: string[]): number {
  if (searchWords.length === 0) return 0;
  
  const name = predicate.name.toLowerCase();
  const description = predicate.description?.toLowerCase() || '';
  
  let count = 0;
  searchWords.forEach(word => {
    if (name.includes(word)) count += 2; // Name matches worth more
    if (description.includes(word)) count += 1;
  });
  
  return count;
}

export const useBiolinkPredicates = () => {
  const [predicates, setPredicates] = useState<PredicateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDescriptions = async () => {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/biolink/biolink-model/master/src/biolink_model/schema/biolink_model.yaml',
          { signal: AbortSignal.timeout(10000) }
        );
    
        if (!response.ok) {
          throw new Error('Failed to fetch Biolink Model');
        }
    
        const yamlText = await response.text();
        const data = yaml.load(yamlText) as any;
        
        const slots = data?.slots || {};
        const slotNames = Object.keys(slots);
        
        const startIdx = slotNames.indexOf('related to');
        const endIdx = slotNames.indexOf('association slot');
        
        if (startIdx === -1 || endIdx === -1) {
          throw new Error('Could not find predicate range in slots');
        }
    
        const predicateSlots = slotNames.slice(startIdx, endIdx);
        const allPredicates: PredicateInfo[] = [];
        
        for (const slotName of predicateSlots) {
          const info = slots[slotName];
          const description = info?.description || null;
          const domain = info?.domain || null;
          const range = info?.range || null;
          const is_a = info?.is_a || null;
          const predicateId = slotName.replace(/ /g, '_');
          
          const predicateInfo: PredicateInfo = {
            id: `biolink:${predicateId}`,
            name: slotName,
            description: description,
            domain: domain,
            range: range,
            is_a: is_a
          };
          
          // Only add if not excluded
          if (!shouldExcludePredicate(predicateInfo)) {
            allPredicates.push(predicateInfo);
          }
        }
    
        // AUGMENT with qualified predicates (no description, use name as value)
        for (const qualifiedPred of QUALIFIED_PREDICATES) {
          allPredicates.push({
            id: qualifiedPred,  // Use the text as ID (no biolink: prefix, no underscores)
            name: qualifiedPred,  // Same as ID
            description: null,  // No description for qualified predicates
            domain: null,
            range: null,
            is_a: null
          });
        }
    
        setPredicates(allPredicates);
        setError(null);
        setLoading(false);
    
      } catch (err) {
        console.error('Failed to fetch Biolink YAML:', err);
        
        // FALLBACK: Use local predicates + qualified predicates
        const fallbackPredicates = FALLBACK_PREDICATES.map(pred => {
          const name = pred.replace('biolink:', '').replace(/_/g, ' ');
          return {
            id: pred,
            name: name,
            description: null
          };
        });
    
        // AUGMENT fallback with qualified predicates
        for (const qualifiedPred of QUALIFIED_PREDICATES) {
          fallbackPredicates.push({
            id: qualifiedPred,
            name: qualifiedPred,
            description: null
          });
        }
        
        setPredicates(fallbackPredicates);
        setError('Unable to fetch predicates from Biolink Model - using local list');
        setLoading(false);
      }
    };

    fetchDescriptions();
  }, []);

  return { predicates, loading, error };
};

// Hook to get smart-sorted predicates
export const useSmartPredicateSearch = (
  predicates: PredicateInfo[],
  searchTerm: string,
  llmSuggestion?: string
) => {
  return useMemo(() => {
    // Split search term and LLM suggestion into words
    const searchWords = searchTerm
      .toLowerCase()
      .trim()
      .split(/[\s_-]+/)
      .filter(w => w.length > 0);
    
    const llmWords = (llmSuggestion || '')
      .toLowerCase()
      .trim()
      .split(/[\s_-]+/)
      .filter(w => w.length > 0);

    // If user is typing (has search term)
    if (searchWords.length > 0) {
      const relevant: PredicateInfo[] = [];
      const notRelevant: PredicateInfo[] = [];
      
      predicates.forEach(pred => {
        if (isRelevant(pred, searchWords)) {
          relevant.push(pred);
        } else {
          notRelevant.push(pred);
        }
      });
      
      // Sort relevant by number of matches
      relevant.sort((a, b) => countMatches(b, searchWords) - countMatches(a, searchWords));
      
      // Sort non-relevant by LLM relevance if available
      if (llmWords.length > 0) {
        notRelevant.sort((a, b) => countMatches(b, llmWords) - countMatches(a, llmWords));
      }
      
      return [...relevant, ...notRelevant];
    }
    
    // If only LLM suggestion (no typing yet)
    if (llmWords.length > 0) {
      const relevant: PredicateInfo[] = [];
      const notRelevant: PredicateInfo[] = [];
      
      predicates.forEach(pred => {
        if (isRelevant(pred, llmWords)) {
          relevant.push(pred);
        } else {
          notRelevant.push(pred);
        }
      });
      
      // Sort relevant by number of matches
      relevant.sort((a, b) => countMatches(b, llmWords) - countMatches(a, llmWords));
      
      return [...relevant, ...notRelevant];
    }
    
    // No search, no LLM - return original order
    return predicates;
  }, [predicates, searchTerm, llmSuggestion]);
};
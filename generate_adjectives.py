#!/usr/bin/env python3
"""Build a French adjective practice database from Kaikki/Wiktionary JSONL.

Usage: python generate_adjectives.py kaikki.org-dictionary-French.jsonl

Writes adjectives/adjectives.json and adjectives/adjectives_review.json.
Uses documented paradigms when available and conservative regular rules otherwise.
No third-party dependencies.
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'adjectives'
SPECIAL = {'beau':'bel', 'nouveau':'nouvel', 'vieux':'vieil', 'fou':'fol', 'mou':'mol'}
OVERRIDES = {
    'beau': ('beau','belle','beaux','belles'),
    'nouveau': ('nouveau','nouvelle','nouveaux','nouvelles'),
    'vieux': ('vieux','vieille','vieux','vieilles'),
    'fou': ('fou','folle','fous','folles'),
    'mou': ('mou','molle','mous','molles'),
    'blanc': ('blanc','blanche','blancs','blanches'),
    'sec': ('sec','sèche','secs','sèches'),
    'frais': ('frais','fraîche','frais','fraîches'),
    'doux': ('doux','douce','doux','douces'),
    'faux': ('faux','fausse','faux','fausses'),
    'roux': ('roux','rousse','roux','rousses'),
    'long': ('long','longue','longs','longues'),
    'public': ('public','publique','publics','publiques'),
    'grec': ('grec','grecque','grecs','grecques'),
    'turc': ('turc','turque','turcs','turques'),
    'gentil': ('gentil','gentille','gentils','gentilles'),
    'nul': ('nul','nulle','nuls','nulles'),
    'cruel': ('cruel','cruelle','cruels','cruelles'),
    'réel': ('réel','réelle','réels','réelles'),
    'pareil': ('pareil','pareille','pareils','pareilles'),
    'meilleur': ('meilleur','meilleure','meilleurs','meilleures'),
}
FORM_KEYS = ('masculine_singular','feminine_singular','masculine_plural','feminine_plural')
FORM_OF_RE = re.compile(r'\b(?:feminine|masculine)\s+(?:singular|plural)\s+of\b|\b(?:plural|singular|inflection|form)\s+of\b', re.I)

def clean(x):
    return re.sub(r'\s+', ' ', x).strip() if isinstance(x, str) else ''

def norm(x):
    return clean(x).casefold()

def tags(obj):
    return {str(t).lower().replace('_','-') for t in (obj.get('tags') or []) if isinstance(t,str)}

def senses(entry):
    return [s for s in (entry.get('senses') or []) if isinstance(s,dict)]

def glosses(s):
    return [clean(x) for x in (s.get('glosses') or []) if clean(x)]

def is_form_only(entry):
    ss = senses(entry)
    if not ss: return 'form-of' in tags(entry)
    return all(('form-of' in tags(s)) or any(FORM_OF_RE.search(g) for g in glosses(s)) or bool(s.get('form_of')) for s in ss)

def english(entry):
    result=[]
    for s in senses(entry):
        if ('form-of' in tags(s)) or s.get('form_of') or any(FORM_OF_RE.search(g) for g in glosses(s)):
            continue
        for g in glosses(s):
            if g not in result: result.append(g)
    return result

def extract_forms(entry):
    result=defaultdict(set)
    for f in entry.get('forms') or []:
        if not isinstance(f,dict): continue
        word=clean(f.get('form'))
        if not word or word in ('-','—'): continue
        ts=tags(f)
        genders=[g for g in ('masculine','feminine') if g in ts]
        numbers=[n for n in ('singular','plural') if n in ts]
        for g in genders:
            for n in numbers:
                result[g+'_'+n].add(word)
    return result

def regular(word):
    """Conservative morphology. Return None for patterns needing verification."""
    w=word
    if not re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿœŒæÆ'-]+", w): return None
    if '-' in w or "'" in w or ' ' in w: return None
    if norm(w) in OVERRIDES: return OVERRIDES[norm(w)]
    # These endings can be inflected irregularly; do not silently invent a paradigm.
    if w.endswith(('eur','teur','oux','eau','al','ail','c','g','f','x','s','et','ot','el','eil','en','on','ien')):
        # -al is regularly -aux in masculine plural, but exceptions exist.
        return None
    if w.endswith('e'):
        fs=w
    elif w.endswith('é'):
        fs=w+'e'
    else:
        fs=w+'e'
    mp=w if w.endswith(('s','x')) else w+'s'
    fp=fs if fs.endswith(('s','x')) else fs+'s'
    return (w,fs,mp,fp)

def build(path):
    candidates={}
    form_entries=set()
    total=0
    with path.open('r',encoding='utf-8',errors='replace') as source:
        for line in source:
            try: e=json.loads(line)
            except json.JSONDecodeError: continue
            if e.get('pos')!='adj': continue
            word=clean(e.get('word'))
            if not word: continue
            total+=1
            key=norm(word)
            if is_form_only(e):
                form_entries.add(key)
                continue
            item=candidates.setdefault(key, {'word':word,'english':[],'forms':defaultdict(set),'lemma_evidence':False})
            meanings=english(e)
            if meanings: item['lemma_evidence']=True
            for m in meanings:
                if m not in item['english']: item['english'].append(m)
            for slot,values in extract_forms(e).items(): item['forms'][slot].update(values)
    # Build cross-lemma inflection index, but never delete a lexical lemma solely
    # because its spelling also appears as another lemma's inflected form.
    inflections=defaultdict(set)
    for key,c in candidates.items():
        for slot in FORM_KEYS[1:]:
            for value in c['forms'].get(slot,()):
                if norm(value)!=key: inflections[norm(value)].add(key)
    results=[]; review=[]; removed=0; rule_count=0; explicit_count=0
    for key,c in sorted(candidates.items()):
        if not c['lemma_evidence']:
            review.append({'word':c['word'],'reason':'No independent lexical meaning'}); continue
        # If it is explicitly a form-of in some entry AND also has independent
        # lexical senses, retain for review unless masculine-singular evidence exists.
        if key in form_entries and inflections.get(key) and key not in {norm(v) for v in c['forms'].get('masculine_singular',())}:
            removed+=1
            review.append({'word':c['word'],'reason':'Potential inflected headword; needs review'}); continue
        forms=c['forms']
        if key in OVERRIDES:
            chosen=OVERRIDES[key]; explicit_count+=1
        else:
            parsed=[]
            for slot in FORM_KEYS:
                values=forms.get(slot,set())
                if slot=='masculine_singular' and not values: values={c['word']}
                parsed.append(next(iter(values)) if len(values)==1 else None)
            if all(parsed) and norm(parsed[0])==key:
                chosen=tuple(parsed); explicit_count+=1
            else:
                guessed=regular(c['word'])
                if guessed is None:
                    review.append({'word':c['word'],'reason':'Insufficient or ambiguous inflection evidence'}); continue
                # Never override explicit contradictory Wiktionary evidence.
                if any(forms.get(slot) and guessed[i] not in forms[slot] for i,slot in enumerate(FORM_KEYS)):
                    review.append({'word':c['word'],'reason':'Regular rule conflicts with source paradigm'}); continue
                chosen=guessed; rule_count+=1
        output={'word':c['word'],'english':c['english'],'forms':dict(zip(FORM_KEYS,chosen))}
        if key in SPECIAL: output['forms']['masculine_before_vowel']=SPECIAL[key]
        results.append(output)
    print(f'Adjective entries read: {total:,}')
    print(f'Candidate headwords: {len(candidates):,}')
    print(f'Potential inflected headwords excluded: {removed:,}')
    print(f'Using documented/verified paradigms: {explicit_count:,}')
    print(f'Using conservative regular rules: {rule_count:,}')
    print(f'Complete adjectives: {len(results):,}')
    print(f'Need review: {len(review):,}')
    # A small result likely indicates a parser mismatch; never destroy prior files.
    if len(results)<1000:
        raise RuntimeError('Only '+str(len(results))+' adjectives found. Existing JSON files were NOT overwritten.')
    OUT.mkdir(parents=True,exist_ok=True)
    for target,data in ((OUT/'adjectives.json',results),(OUT/'adjectives_review.json',review)):
        tmp=target.with_suffix(target.suffix+'.tmp')
        with tmp.open('w',encoding='utf-8') as f: json.dump(data,f,ensure_ascii=False,indent=2)
        tmp.replace(target)
        print('Saved:',target)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('source',type=Path)
    args=p.parse_args()
    if not args.source.is_file(): p.error('File not found: '+str(args.source))
    build(args.source)

if __name__=='__main__': main()

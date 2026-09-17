#!/usr/bin/env python3
"""Generate the Administration Educational Film Vault public derivative."""
from __future__ import annotations
import argparse,json,re,shutil,sys
from pathlib import Path
import jinja2
ROOT=Path(__file__).resolve().parent.parent
DOCS=ROOT/'docs'; OUT=DOCS/'films'; SRC=ROOT/'src/films/films.json'; AUTH=ROOT/'src/films/AUTHORITY.md'; SCHEMA=ROOT/'src/schema/administration-film-vault.schema.json'; TEMPLATES=ROOT/'src/templates'
sys.path.insert(0,str(ROOT/'build'))
import machine_publication as machine

def jt(v): return json.dumps(v,indent=2,ensure_ascii=False,sort_keys=True)+'\n'
def load():
    d=json.loads(SRC.read_text())
    if d.get('schema')!='starsilk-administration-film-source/1': raise RuntimeError('unsupported film source schema')
    if d.get('issuer')!='Administration' or d.get('slogan')!='Your fate is in our hands.': raise RuntimeError('Administration issuer/slogan lock failed')
    ids=[f.get('film_id') for f in d.get('films',[])]
    if not ids or len(ids)!=len(set(ids)) or any(not re.fullmatch(r'reel-[0-9]{3}',x or '') for x in ids): raise RuntimeError('invalid or duplicate film IDs')
    valid={r['stable_id'] for r in machine.build_entity_records(machine.generate.load_sections(machine.generate.load_media_rename_map()),machine.load_manifest())}
    for film in d['films']:
        missing=set(film.get('source_stable_ids',[]))-valid
        if missing: raise RuntimeError(f"{film['film_id']} unknown source stable IDs: {sorted(missing)}")
        if film['status']=='planned' and (film.get('scenes') or film.get('teacher_questions')): raise RuntimeError(f"planned reel {film['film_id']} cannot claim finished scenes")
    return d

def outputs():
    d=load(); env=jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES)),autoescape=True)
    html=env.get_template('films.html.j2').render(project_name='Starsilk Compendium',canonical_url=machine.canonical('films/'),films=d['films'],slogan=d['slogan'])
    return {'index.html':html,'films.css':(TEMPLATES/'films.css').read_text().rstrip()+'\n','films.json':jt(d),'schema.json':SCHEMA.read_text().rstrip()+'\n','AUTHORITY.md':AUTH.read_text().rstrip()+'\n'}
def actual(): return {p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file()} if OUT.exists() else set()
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--check',action='store_true'); a=ap.parse_args(); o=outputs()
    if a.check:
        errs=[]
        if actual()!=set(o): errs.append(f'generated film file set differs: expected={sorted(o)} actual={sorted(actual())}')
        for n,t in o.items():
            p=OUT/n
            if p.exists() and p.read_text()!=t: errs.append(f'generated film output differs: docs/films/{n}')
            elif not p.exists(): errs.append(f'missing generated film output: docs/films/{n}')
        if errs:
            print('\n'.join('ERROR: '+e for e in errs),file=sys.stderr); return 1
        print(f'OK: {len(o)} film-vault outputs match generator output.'); return 0
    if OUT.exists(): shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for n,t in o.items(): (OUT/n).write_text(t); print('Wrote',OUT/n)
    return 0
if __name__=='__main__': raise SystemExit(main())

import json
import subprocess
import sys
from pathlib import Path
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
DOCS=ROOT/'docs'

def load(rel): return json.loads((ROOT/rel).read_text(encoding='utf-8'))

def test_record_index_is_deterministic_stable_and_classified():
    proc=subprocess.run([sys.executable,'build/record_explorer.py','--check'],cwd=ROOT,text=True,capture_output=True)
    assert proc.returncode==0, proc.stdout+proc.stderr
    model=load('docs/records/records.json'); entities=load('docs/machine/entities.json')['records']
    ids=[r['stable_id'] for r in model['records']]
    assert ids==[r['stable_id'] for r in entities]
    assert len(ids)==len(set(ids))==model['record_count']==127
    allowed=set(model['evidence_classes'])
    for record in model['records']:
        assert record['source']['path']
        for items in record['categories'].values():
            for item in items:
                assert item['evidence_class'] in allowed
                assert item['source_pointer']
                assert item['url'].startswith('https://westkitty.github.io/Starsilk_Character_Dossier/')

def test_mentions_remain_mentions_and_chronology_is_not_inferred():
    model=load('docs/records/records.json'); by={r['stable_id']:r for r in model['records']}
    for record in model['records']:
        for item in record['categories'].get('Mentions',[]):
            assert item['evidence_class']=='observed-xref'
            assert item['kind']=='mentions'
    chronology_ids={r['stable_id'] for r in model['records'] if r['facets']['hasChronology']}
    assert chronology_ids=={'chronology'}
    authored=load('src/chronology/events.json')['events']
    assert len(by['chronology']['categories']['Timeline'])==len(authored)

def test_machine_locks_and_media_are_exactly_source_backed():
    model=load('docs/records/records.json'); by={r['stable_id']:r for r in model['records']}
    locks=load('src/canon/invariants.json')['section_locks']
    expected={}
    for lock in locks: expected.setdefault(lock['section'],[]).append(lock['id'])
    for stable_id,record in by.items():
        actual=[x['lock_id'] for x in record['categories'].get('Canon',[])]
        assert actual==expected.get(stable_id,[])
    manifest_ids={a['filename'] for a in load('docs/asset-manifest.json')['assets']}
    for record in model['records']:
        for item in record['categories'].get('Media / Objects',[]): assert item['media_id'] in manifest_ids

def test_world_film_and_tour_links_require_explicit_source_membership():
    model=load('docs/records/records.json'); by={r['stable_id']:r for r in model['records']}
    world=load('src/worldsvault/topology.json')
    for node in world['nodes']:
        sid=node['source']['stable_id']
        assert any(x.get('node_id')==node['node_id'] for x in by[sid]['categories'].get('Worlds',[]))
    films=load('src/films/films.json')['films']
    for film in films:
        for sid in film['source_stable_ids']:
            assert any(x.get('film_id')==film['film_id'] for x in by[sid]['categories'].get('Films',[]))

def test_entity_pages_expose_map_and_accessible_text_equivalent():
    for sid in ('codec','dao','chronology','beyond-wall'):
        soup=BeautifulSoup((DOCS/'entities'/sid/'index.html').read_text(encoding='utf-8'),'html.parser')
        area=soup.select_one('#explore-this-record'); assert area
        assert area.select_one('.entity-context-map[role="img"]')
        text=area.select_one('.entity-explorer-list[aria-label]'); assert text
        assert text.select('.entity-evidence-class')

def test_search_surface_and_offline_shell_are_local_and_small():
    soup=BeautifulSoup((DOCS/'records/index.html').read_text(encoding='utf-8'),'html.parser')
    assert soup.select_one('#recordQuery') and soup.select_one('#recordType')
    assert len(soup.select('[data-record-facet]'))==11
    js=(DOCS/'records/records.js').read_text(encoding='utf-8')
    assert 'fetch("search.json")' in js
    assert 'http://' not in js and 'https://' not in js
    config=load('src/offline/config.json')
    for item in ('records/index.html','records/records.css','records/records.js','records/search.json'): assert item in config['precache']
    assert 'records/records.json' not in config['precache']
    size=sum((DOCS/x).stat().st_size for x in config['precache'])
    assert size<2_000_000

import json
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent
DOCS=ROOT/'docs'

def payload(): return json.loads((DOCS/'films/films.json').read_text())

def test_film_vault_catalog_is_bounded_and_administration_issued():
    data=payload(); assert data['issuer']=='Administration'; assert data['slogan']=='Your fate is in our hands.'
    assert [f['film_id'] for f in data['films']]==[f'reel-{i:03d}' for i in range(1,7)]
    assert data['films'][0]['status']=='production-treatment'
    assert all(f['status']=='planned' for f in data['films'][1:])

def test_only_exemplar_claims_completed_scene_treatment():
    films=payload()['films']; assert len(films[0]['scenes'])==8; assert len(films[0]['teacher_questions'])==5
    assert all(not f['scenes'] and not f['teacher_questions'] for f in films[1:])

def test_film_sources_resolve_to_existing_stable_records():
    sections=json.loads((ROOT/'src/content/sections.json').read_text())['sections']; ids={s['id'] for s in sections}
    for f in payload()['films']: assert set(f['source_stable_ids']) <= ids

def test_human_vault_is_diegetic_but_exposes_authority_boundary():
    soup=BeautifulSoup((DOCS/'films/index.html').read_text(),'html.parser')
    assert soup.find('header',class_='museum-nav',attrs={'data-museum-shell':'unified'}) is not None
    assert soup.find('div',class_='projector-screen') is not None
    text=soup.get_text(' ',strip=True)
    assert 'Your fate is in our hands.' in text
    assert 'Institutional framing is not objective canon authority' in text
    assert 'REEL NOT YET PRODUCED' in text

def test_root_and_shared_nav_discover_film_vault():
    root=BeautifulSoup((DOCS/'index.html').read_text(),'html.parser')
    assert root.find('a',href='films/',class_='museum-module') is not None
    tours=BeautifulSoup((DOCS/'tours/index.html').read_text(),'html.parser')
    assert tours.find('a',href='../films/') is not None

def test_film_vault_runtime_preserves_projector_ratio_and_mobile_width(page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    response = page.goto(f"{local_server}/films/", wait_until="domcontentloaded")
    assert response is not None and response.ok
    screen = page.locator('.projector-screen').first
    box = screen.bounding_box()
    assert box is not None
    assert abs((box['width'] / box['height']) - (4 / 3)) < 0.03
    overflow_count = page.locator('.film-vault-main').evaluate("""(main) => { const m=main.getBoundingClientRect(); return [...main.querySelectorAll('*')].filter((e) => { const r=e.getBoundingClientRect(); return r.right > m.right + 1 || r.left < m.left - 1; }).length; }""")
    assert overflow_count == 0
    assert page.get_by_text('REEL NOT YET PRODUCED').count() == 5

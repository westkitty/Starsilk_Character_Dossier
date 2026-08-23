import base64

from playwright.sync_api import Page, expect

PNG_1X1 = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+R2slWQAAAABJRU5ErkJggg=='
)

def unlock(page: Page, local_server: str):
    page.goto(f'{local_server}/index.html')
    page.locator('#dossierSearch').fill('ajd')
    expect(page.locator('#modeToggle')).to_be_visible()

def test_archive_prompt_control_is_session_only(page: Page, local_server):
    page.goto(f'{local_server}/index.html')
    copy_btn = page.locator('#copyImplementationPrompt')
    expect(copy_btn).to_be_hidden()
    page.locator('#dossierSearch').fill('ajd')
    expect(copy_btn).to_be_visible()
    expect(copy_btn).to_have_text('Copy implementation prompt')
    page.locator('#modeToggle').click()
    expect(copy_btn).to_be_hidden()
    page.reload()
    expect(copy_btn).to_be_hidden()

def test_all_archive_slots_have_unique_stable_identity(page: Page, local_server):
    page.goto(f'{local_server}/index.html')
    stages = page.locator('.attachment-stage')
    assert stages.count() == 26
    identities = stages.evaluate_all("els => els.map(el => ({key: el.closest('[data-asset-key]')?.getAttribute('data-asset-key') || '', number: el.querySelector('.asset-number')?.textContent.trim() || ''}))")
    assert len({item['key'] for item in identities}) == 26
    assert all(item['key'] for item in identities)
    target = page.locator('[data-asset-key="asset-19"] .attachment-stage')
    assert target.count() == 1
    assert target.evaluate("el => el.querySelector('.asset-number')?.textContent.trim()") == '19'

def test_copy_prompt_binds_change_to_asset_key_and_export_carries_media(page: Page, local_server, tmp_path):
    page.context.grant_permissions(['clipboard-read', 'clipboard-write'], origin=local_server)
    unlock(page, local_server)
    test_img = tmp_path / 'handoff-test.png'
    test_img.write_bytes(PNG_1X1)
    target_stage = page.locator('[data-asset-key="asset-19"] .attachment-stage')
    target_stage.locator('.asset-file').set_input_files(str(test_img))
    expect(page.locator('#assetStatus')).to_contain_text('1 of 26')

    page.locator('#copyImplementationPrompt').click()
    expect(page.locator('#copyPromptStatus')).to_contain_text('Implementation prompt copied')
    prompt = page.evaluate('navigator.clipboard.readText()')
    assert '"slot": "19"' in prompt
    assert '"asset_key": "asset-19"' in prompt
    assert '"title": "Administration allocation facility"' in prompt
    assert '"identity_status": "stable"' in prompt
    assert '"action": "attach"' in prompt
    assert '"name": "handoff-test.png"' in prompt
    assert 'starsilk_character_dossier_copy.html' in prompt
    assert 'Do not hand-edit docs/index.html' in prompt
    assert 'Never substitute DOM position for that identity' in prompt
    assert 'Stage only the intended files' in prompt
    assert 'commit with a descriptive message' in prompt
    assert 'push' in prompt
    assert 'lands on main' in prompt
    assert 'BLOCKED:' not in prompt

    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")
    with page.expect_download() as download_info:
        page.locator('#exportEmbedded').click()
    export_path = tmp_path / 'starsilk_character_dossier_copy.html'
    download_info.value.save_as(str(export_path))
    exported = export_path.read_text(encoding='utf-8')
    assert 'data:image/png;base64,' in exported
    assert 'id="copyImplementationPrompt"' not in exported
    assert 'id="copyPromptStatus"' not in exported

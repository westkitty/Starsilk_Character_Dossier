(() => {
  const nodes = [...document.querySelectorAll('.topology-node')];
  const edges = [...document.querySelectorAll('[data-edge-id]')];
  const status = document.querySelector('#topologyStatus');
  let selected = null;
  const render = () => {
    const connected = new Set();
    edges.forEach(edge => { const active = !selected || edge.dataset.source === selected || edge.dataset.target === selected; edge.classList.toggle('is-muted', !active); if (active) { connected.add(edge.dataset.source); connected.add(edge.dataset.target); } });
    nodes.forEach(node => { const id = node.dataset.nodeId; node.classList.toggle('is-selected', id === selected); node.classList.toggle('is-connected', Boolean(selected && connected.has(id) && id !== selected)); node.classList.toggle('is-muted', Boolean(selected && !connected.has(id))); });
    status.textContent = selected ? `Selected ${selected}. Showing directly authored edges touching this node.` : `${nodes.length} source-backed nodes and ${edges.length} direct authored edges.`;
  };
  const select = id => { selected = id; history.replaceState(null, '', `#node-${id}`); render(); };
  nodes.forEach(node => { node.addEventListener('click', () => select(node.dataset.nodeId)); node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.dataset.nodeId); } }); });
  document.querySelector('#clearSelection').addEventListener('click', () => { selected = null; history.replaceState(null, '', location.pathname); render(); });
  document.querySelector('#showAll').addEventListener('click', () => { selected = null; render(); });
  const hashNode = location.hash.match(/^#node-([a-z0-9-]+)$/); if (hashNode && nodes.some(node => node.dataset.nodeId === hashNode[1])) selected = hashNode[1]; render();
})();

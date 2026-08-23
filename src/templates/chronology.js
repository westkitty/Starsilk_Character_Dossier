(() => {
  const controls = ["visibility", "canon", "spoiler", "temporal"].map((name) => document.querySelector(`#${name}Filter`));
  const cards = [...document.querySelectorAll(".chronology-event")];
  const status = document.querySelector("#chronologyStatus");
  const reset = document.querySelector("#resetFilters");
  const params = new URLSearchParams(location.search);
  controls.forEach((control) => { if (params.has(control.name)) control.value = params.get(control.name); });
  const apply = () => {
    const values = Object.fromEntries(controls.map((control) => [control.name, control.value]));
    let visible = 0;
    cards.forEach((card) => {
      const show = Object.entries(values).every(([name, value]) => value === "all" || card.dataset[name] === value);
      card.hidden = !show;
      if (show) visible += 1;
    });
    status.textContent = `${visible} of ${cards.length} events in this view. Filters do not alter chronology JSON or event status.`;
    const next = new URLSearchParams(); controls.forEach((control) => { if (control.value !== "all") next.set(control.name, control.value); });
    history.replaceState(null, "", `${location.pathname}${next.size ? `?${next}` : ""}${location.hash}`);
  };
  controls.forEach((control) => control.addEventListener("change", apply));
  reset.addEventListener("click", () => { controls.forEach((control) => { control.value = "all"; }); apply(); controls[0].focus(); });
  apply();
})();

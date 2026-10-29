(() => {
  const menu = document.getElementById('adminMenu'), compact = matchMedia('(max-width: 900px)');
  const configure = () => { menu.open = !compact.matches; };
  configure(); compact.addEventListener('change', configure);
})();

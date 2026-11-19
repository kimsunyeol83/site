// 사진을 누르면 크게 보여 준다. 링크가 걸린 사진은 링크를 따른다.
(function () {
  var box, boxImg, last;
  function open(src, alt) {
    if (!box) {
      box = document.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<button class="lightbox__close" type="button">닫기</button><img alt="">';
      boxImg = box.querySelector('img');
      box.addEventListener('click', close);
      document.body.appendChild(box);
    }
    boxImg.src = src;
    boxImg.alt = alt || '';
    box.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    box.querySelector('button').focus();
  }
  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    boxImg.removeAttribute('src');
    document.documentElement.style.overflow = '';
    if (last) last.focus();
  }
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('img[data-full]');
    if (!img || img.closest('a')) return;
    last = img;
    open(img.getAttribute('data-full'), img.alt);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();

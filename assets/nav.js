// 上のメニューの印・サイドバー（ページ一覧＋このページの目次）を作る。file:// でも動く。
(function () {
  'use strict';
  var PAGES = [
    { g: 'はじめに', items: [['index.html', 'トップ'], ['controls.html', '操作（キー）'], ['screens.html', '画面の見かた'], ['map.html', '地図（ミニマップ）'], ['guide.html', 'ゲームの進め方'], ['strategy.html', '攻略・おすすめ']] },
    { g: 'しくみ', items: [['status.html', 'ステータス・呪力'], ['gear.html', '呪具・防具・守り'], ['craft.html', '呪いの作業台'], ['domain.html', '領域展開'], ['challenge.html', '全体チャレンジ']] },
    { g: '敵', items: [['curses.html', '呪霊'], ['bosses.html', 'ボス'], ['simuria.html', 'シムリア星']] },
    { g: '術式', items: [['gojo.html', '五条（無下限呪術）'], ['rika.html', '乙骨（里香）'], ['tokusa.html', '十種影法術']] },
    { g: 'そのほか', items: [['world.html', '畑・時計・ネザー・エンディング'], ['sim.html', 'シミュレーター']] }
  ];
  var here = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  if (here === '') here = 'index.html';

  // 上のメニュー
  var links = document.querySelectorAll('.site-nav a.nl');
  for (var i = 0; i < links.length; i++) {
    if (links[i].getAttribute('href') === here) {
      links[i].classList.add('on');
      links[i].setAttribute('aria-current', 'page');
      var box = links[i].parentNode;
      box.scrollLeft = Math.max(0, links[i].offsetLeft - box.clientWidth / 2 + links[i].offsetWidth / 2);
    }
  }

  // サイドバー
  var main = document.querySelector('main');
  if (!main) return;
  var allH2 = main.querySelectorAll('h2');
  for (var k = 0; k < allH2.length; k++) if (!allH2[k].id) allH2[k].id = 'sec-' + (k + 1);
  var side = document.createElement('aside');
  side.className = 'sidebar';
  side.id = 'sidebar';
  side.setAttribute('aria-label', 'サイドバー');
  var h = '';
  PAGES.forEach(function (grp) {
    h += '<div class="sb-group">' + grp.g + '</div><ul>';
    grp.items.forEach(function (it) {
      var on = it[0] === here;
      h += '<li><a href="' + it[0] + '"' + (on ? ' class="on" aria-current="page"' : '') + '>' + it[1] + '</a>';
      if (on) {
        var hs = main.querySelectorAll('h2[id]');
        if (hs.length) {
          h += '<ul class="sb-toc">';
          for (var j = 0; j < hs.length; j++) {
            h += '<li><a href="#' + hs[j].id + '" data-sec="' + hs[j].id + '">' + hs[j].textContent.replace(/(確定|目安)$/, '').trim() + '</a></li>';
          }
          h += '</ul>';
        }
      }
      h += '</li>';
    });
    h += '</ul>';
  });
  side.innerHTML = h;

  var wrap = document.createElement('div');
  wrap.className = 'layout';
  main.parentNode.insertBefore(wrap, main);
  wrap.appendChild(side);
  wrap.appendChild(main);

  // スマホ用の開閉ボタン
  var btn = document.createElement('button');
  btn.className = 'sb-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-controls', 'sidebar');
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = '☰ 目次';
  document.body.appendChild(btn);
  var shade = document.createElement('div');
  shade.className = 'sb-shade';
  document.body.appendChild(shade);
  function setOpen(v) {
    document.body.classList.toggle('sb-open', v);
    btn.setAttribute('aria-expanded', v ? 'true' : 'false');
    btn.textContent = v ? '✕ 閉じる' : '☰ 目次';
  }
  btn.addEventListener('click', function () { setOpen(!document.body.classList.contains('sb-open')); });
  shade.addEventListener('click', function () { setOpen(false); });
  side.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });

  // 今読んでいる見出しに印
  var secs = side.querySelectorAll('a[data-sec]');
  if (secs.length && 'IntersectionObserver' in window) {
    var cur = null;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) {
          if (cur) cur.classList.remove('here');
          cur = side.querySelector('a[data-sec="' + en.target.id + '"]');
          if (cur) cur.classList.add('here');
        }
      });
    }, { rootMargin: '-70px 0px -70% 0px' });
    main.querySelectorAll('h2[id]').forEach(function (el) { io.observe(el); });
  }
})();

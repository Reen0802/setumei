// ver17β ダメージ（ステータス）シミュレーター
// 計算式はデータパックの mcfunction（a:loss, a:ykkr, t:pay, t:stats など）から読み取ったもの。
(function () {
  'use strict';

  // ---------- 共通の計算 ----------
  var fl = Math.floor;

  // a:loss … 消費呪力 = max(0, a×(術式−操作)) + b + c×術式   （六眼なら前の2つが0）
  function loss(s, a, b, c) {
    var p = a * (s.jut - s.sous);
    if (p < 0) p = 0;
    p += b;
    if (s.eye) p = 0;
    return p + c * s.jut;
  }
  // a:ykkr … 焼き切れ = max(10, A + 術式 − B×操作)   （六眼なら B×操作 が2倍）
  function burn(s, A, B) {
    var m = B * s.sous;
    if (s.eye) m *= 2;
    var v = A + s.jut - m;
    return v < 10 ? 10 : v;
  }
  // t:out_cost … 出力Ⅰは半分、出力Ⅲは1.5倍（切り上げ）
  function oc(s, x) {
    if (s.cha === 1) return fl((x * 1 + 1) / 2);
    if (s.cha === 3) return fl((x * 3 + 1) / 2);
    return x;
  }
  // t:pay … a,b,c それぞれに出力をかけてから a:loss（領域の中は ha,hb,hc）
  function tpay(s, a, b, c, ha, hb, hc) {
    if (s.inRy) { a = ha; b = hb; c = hc; }
    return loss({ jut: s.jut, sous: s.sous, eye: false }, oc(s, a), oc(s, b), oc(s, c));
  }
  // t:stats … 体力・攻撃（×10の整数）
  function tstats(s, hb, hk, ab, ak) {
    var lvm = 17 + s.lv;
    var hp = hk * s.sous + hb;
    var atk = ak * s.jut + ab;
    hp = fl(hp * lvm / 18);
    atk = fl(atk * lvm / 18);
    if (s.cha === 1) { hp = fl(hp / 2); atk = fl(atk / 2); }
    if (s.cha === 3) { hp = fl(hp * 9 / 5); atk = fl(atk * 9 / 5); }
    if (hp > 1024) hp = 1024;
    if (hp < 1) hp = 1;
    var arm = fl(s.sous / 2); if (arm > 30) arm = 30;
    if (s.genki) atk = fl(atk * 6 / 5);
    return { hp: hp, atk10: atk, atk: atk / 10, arm: arm };
  }
  function maxJu(s) { return s.mj >= 0 ? s.mj : fl(s.jum2 * (100 + 4 * s.jum) / 100); }
  function rikaMaxJu(s) { return s.mj >= 0 ? s.mj : fl((s.jum2 + 5000) * (100 + 8 * s.jum) / 100); }
  function hantenCost(s) {
    if (s.eye) return 375 - (s.sous >= 374 ? 374 : 0);
    return 1500 - Math.min(s.sous, 1499);
  }
  function playerAtk(s) { // a:state … 攻撃力 = 攻撃力スコア×0.2（5以下なら1）
    return s.st <= 5 ? 1 : s.st * 0.2;
  }

  var TARGETS = [
    { id: 'mob', name: '普通のモブ（防具は考えない）', red: 0 },
    { id: 'j4', name: '4級呪霊（術式防御8%）', red: 8 },
    { id: 'j3', name: '3級呪霊（16%）', red: 16 },
    { id: 'j2', name: '2級呪霊（24%）', red: 24 },
    { id: 'j1', name: '1級呪霊（36%）', red: 36 },
    { id: 'jt', name: '特級呪霊（48%）', red: 48 },
    { id: 'boss', name: 'ボス（60%）', red: 60 },
    { id: 'jn', name: 'ネザー呪霊（80%）', red: 80 }
  ];
  var RANKS = [
    { id: 0, name: 'なし', arm: 0, cd: 10 },
    { id: 1, name: '4級', arm: 2, cd: 9 },
    { id: 2, name: '3級', arm: 5, cd: 8 },
    { id: 3, name: '準2級', arm: 5, cd: 7 },
    { id: 4, name: '2級', arm: 10, cd: 6 },
    { id: 5, name: '準1級', arm: 10, cd: 5 },
    { id: 6, name: '1級', arm: 15, cd: 5 },
    { id: 7, name: '特別1級', arm: 15, cd: 3 },
    { id: 8, name: '特級', arm: 30, cd: 1 }
  ];

  // ---------- 技の定義 ----------
  // 各行: { name, cost, burn, dmg(1回), hits(目安の回数), unit, range, note, est(目安か) }
  function gojoRows(s) {
    var t2 = s.toku2 ? 2 : 1;
    var R = [];
    var ao = [[1, 5, 100, 1, 0.004, 50, 1, 10], [2, 10, 200, 5, 0.005, 100, 2, 15], [3, 15, 300, 10, 0.006, 200, 3, 20]];
    ao.forEach(function (r) {
      var per = (5 + s.jut) * r[4];
      var ticks = r[5] + s.sous * r[6];
      R.push({ name: '蒼 ' + roman(r[0]), cost: loss(s, r[1], r[2], r[3]), burn: burn(s, 100, 2), dmg: per, unit: '/tick',
        hits: Math.round(ticks / 1.7), range: '吸込' + r[7] + '・当たり2.5', note: '止まる長さ ' + ticks + 'tick（' + (ticks / 20).toFixed(1) + '秒）', est: true, hitsEst: true });
    });
    R.push({ name: '最大出力の蒼', cost: loss(s, 50, 30, 10), burn: burn(s, 50, 2), dmg: null, range: '巨大', note: '出力Ⅱで2.5秒スニーク。地形破壊用' });
    var aka = [[1, 10, 300, 3, 0.4], [2, 15, 500, 5, 0.7], [3, 25, 700, 10, 1.4]];
    aka.forEach(function (r) {
      // 赫のダメージは整数に切り捨てて保存される（DeathTime int）
      R.push({ name: '赫 ' + roman(r[0]), cost: loss(s, r[1], r[2], r[3]), burn: burn(s, 150, 3), dmg: fl((3 + s.jut * t2) * r[4] + 1e-9), hits: 1,
        range: '前方 半径5', note: '壁や生き物にぶつかったとき' });
    });
    R.push({ name: '詠唱赫', cost: loss(s, 60, 500, 60), burn: burn(s, 240, 3) + 100, dmg: s.jut * 5 * t2, hits: 1, range: '最後に半径5', note: '飛ぶ間は押しながら1ずつ' });
    // 茈のダメージも整数に切り捨て（Fire int）
    var mu = [[1, 10, 100, 10, 0.3, 300, 3, 1.5], [2, 25, 300, 20, 0.6, 300, 5, 2], [3, 50, 1000, 50, 1.5, 400, 7, 3]];
    mu.forEach(function (r) {
      var hits = Math.round(r[6] * 2 / r[7]);
      R.push({ name: '茈 ' + roman(r[0]), cost: loss(s, r[1], r[2], r[3]), burn: burn(s, r[5], 2), dmg: fl((5 + s.jut) * r[4] + 1e-9), unit: '/tick',
        hits: hits, range: '半径' + r[6], note: '速さ' + r[7] + '/tick・6秒', hitsEst: true });
    });
    var muMul = s.cha === 1 ? 0.3 : s.cha === 2 ? 0.6 : 1.5;
    R.push({ name: '詠唱茈（出力' + roman(s.cha) + '）', cost: loss(s, 100, 1500, 100), burn: burn(s, 500, 2) + 100, dmg: fl((5 + s.jut) * muMul + 1e-9), unit: '/tick',
      hits: Math.round(24 / 3.5), range: '半径12', note: '今の出力で威力が変わる', hitsEst: true });
    var eaoTicks = 200 + 4 * s.sous;
    var eaoCost = loss(s, 60, 500, 50), eaoBurn = burn(s, 200, 2) + 100;
    R.push({ name: '詠唱蒼', cost: eaoCost, burn: eaoBurn, dmg: (1 + s.jut) * 0.005, unit: '/tick', hits: eaoTicks,
      range: '吸込15・当たり5', note: '出力Ⅲ・' + (eaoTicks / 20).toFixed(1) + '秒残る', hitsEst: true });
    // 無制限の紫：詠唱蒼に詠唱赫をぶつける（b:inf_pu → b:314eis_pu）
    var mpJut = s.zon ? s.jut * 2 : s.jut;
    var mpSize = Math.min(mpJut + (mpJut % 2 === 0 ? 1 : 0), 321);
    if (mpJut <= 1) mpSize = 1;
    R.push({ name: '無制限の紫', cost: eaoCost + loss(s, 60, 500, 60), burn: eaoBurn + burn(s, 240, 3) + 100,
      dmg: fl(s.jut * (s.zon ? 0.25 : 0.15) + 1e-9), unit: '/tick', hits: eaoTicks,
      range: '半径 最大' + fmt(mpSize * 0.4), note: '詠唱蒼＋詠唱赫の合計。爆発の強さ' + fmt(mpSize * 0.2) + '（地形も壊す）', hitsEst: true });
    R.push({ name: '蒼パンチ', cost: loss(s, 10, 40, 0), burn: burn(s, 50, 1), dmg: null, range: '目の前', note: '引き寄せて力Ⅳで殴る' });
    R.push({ name: '蒼ワープ', cost: 100, burn: s.toku4 ? 15 : 30, dmg: null, range: '—', note: '呪力は固定' });
    R.push({ name: '領域「無量空処」', cost: 1500, burn: burn(s, 150, 1), dmg: null, range: '半径18', note: '<a href="domain.html">領域</a>' });
    R.push({ name: '反転術式', cost: hantenCost(s), burn: null, dmg: null, range: '自分', note: '実際に減る呪力' });
    return R;
  }

  function rikaRows(s) {
    var R = [];
    var m = s.cha === 1 ? 0.3 : s.cha === 2 ? 0.6 : 1.0;
    var ratk = fl((1 + s.jut) * m + 1e-9);
    var rank = RANKS[s.rank];
    R.push({ name: 'リカの攻撃（出力' + roman(s.cha) + '）', cost: null, burn: null, dmg: ratk, hits: 1, range: '近接',
      note: '呪霊へは ' + (rank.cd / 2) + '秒ごと（' + rank.name + '）', costText: '接続時間10' });
    var atk = playerAtk(s) * 1.3 + (s.body ? 3 : 0);
    R.push({ name: '純愛砲（1発）', cost: 500, burn: null, dmg: s.jut * 0.2, hits: null, range: '弾ごとに4', note: '接続時間 ' + (s.toku2 ? 100 : 300) + ' も使う', costText: '約500' });
    R.push({ name: 'ブギウギ', cost: loss(s, 10, 100, 10), burn: burn(s, 100, 2), dmg: null, range: '15先', note: '位置の入れ替え' });
    R.push({ name: '無下限（模倣）', cost: loss(s, 15, 300, 10), burn: burn(s, 200, 3), dmg: null, range: '3.5', note: '約20秒のバリア' });
    R.push({ name: 'みずし（1回）', cost: loss(s, 50, 100, 10), burn: burn(s, 100, 2), dmg: s.jut * 0.1, hits: null, range: '半径2.5', note: '1秒間の斬撃' });
    R.push({ name: '投射呪法', cost: loss(s, 10, 100, 10), burn: burn(s, 50, 2), dmg: null, range: '—', note: '約4秒高速移動' });
    R.push({ name: '呪言「爆ぜろ」', cost: loss(s, 15, 300, 10), burn: burn(s, 150, 3), dmg: 10, hits: 1, range: '半径10', note: '出る確率20%（固定ダメージ）' });
    R.push({ name: '赤血（1発）', cost: loss(s, 25, 300, 10), burn: burn(s, 100, 1), dmg: s.jut * 0.1, hits: null, range: '半径3', note: '約2.5秒撃ち続ける' });
    R.push({ name: 'うすらび', cost: loss(s, 20, 500, 50), burn: burn(s, 100, 2), dmg: fl(atk * 0.5 + 1e-9) + s.jut, hits: 1, range: '前4', note: '攻撃力 ' + atk.toFixed(1) + ' で計算' });
    R.push({ name: 'ヤコブの梯子', cost: loss(s, 50, 500, 100), burn: null, dmg: null, range: '—', note: '光の柱' });
    R.push({ name: '呪力放出（1本）', cost: loss(s, 10, 300, 10), burn: null, dmg: atk * 0.4, hits: 5, range: '扇形5本', note: '攻撃力 ' + atk.toFixed(1) + ' で計算', hitsNote: '最大5本' });
    var r2 = s.cha === 1 ? [5, 300, 10] : s.cha === 2 ? [10, 500, 20] : [15, 1000, 40];
    R.push({ name: '呪力放出2（出力' + roman(s.cha) + '）', cost: loss(s, r2[0], r2[1], r2[2]), burn: null, dmg: null, range: '—', note: '呪力をまとう' });
    R.push({ name: '領域「真贋相愛」', cost: 1500, burn: burn(s, 150, 1), dmg: null, range: '半径18', note: 'みずし模倣なら中の敵に7（呪霊3）' });
    R.push({ name: '反転術式', cost: hantenCost(s), burn: null, dmg: null, range: '自分', note: '実際に減る呪力' });
    return R;
  }

  // 十種影法術の式神
  var SHIKI = [
    { k: 'inu', name: '玉犬（白・黒 各1体）', st: [30, 5, 20, 5], pay: [10, 100, 5, 5, 50, 2], up: 2, hit: 'melee', cd: 1, range: '近接' },
    { k: 'kon', name: '渾', st: [60, 10, 40, 10], pay: [15, 150, 10, 7, 75, 5], up: 3, hit: 'melee', cd: 1, range: '近接' },
    { k: 'gama', name: '蝦蟇', st: [30, 5, 10, 2], pay: [5, 100, 5, 2, 50, 2], up: 1, hit: 'melee', cd: 2.5, range: '近接・舌8' },
    { k: 'nue', name: '鵺', st: [60, 8, 60, 12], pay: [15, 250, 10, 7, 125, 5], up: 4, hit: 'bolt', range: '雷 半径3' },
    { k: 'dato', name: '脱兎', st: [4, 1, 0, 0], pay: [5, 150, 5, 2, 75, 2], up: 4, hit: 'none', range: '16' },
    { k: 'hebi', name: '大蛇', st: [80, 10, 80, 15], pay: [10, 250, 10, 5, 125, 5], up: 3, hit: 'bite', cd: 1.5, range: '噛みつき5' },
    { k: 'sika', name: '円鹿', st: [40, 16, 20, 5], pay: [15, 200, 10, 7, 100, 5], up: 3, hit: 'sika', range: '半径8' },
    { k: 'ushi', name: '貫牛', st: [0, 0, 50, 8], pay: [10, 200, 10, 5, 100, 5], up: 0, hit: 'ushi', range: '突進' },
    { k: 'zou', name: '満象', st: [150, 15, 100, 20], pay: [30, 600, 30, 15, 300, 15], up: 8, hit: 'zou', cd: 2, range: '水 半径6' },
    { k: 'mako', name: '魔虚羅', st: [300, 20, 150, 20], pay: [50, 1000, 50, 25, 500, 25], up: 15, hit: 'melee', cd: 0.5, range: '近接' }
  ];
  function upkeep(s, u) {
    if (s.inRy) return 0;
    if (s.iji) u = fl(u * 7 / 10);
    return oc(s, u);
  }
  function tokusaRows(s) {
    var R = [];
    SHIKI.forEach(function (d) {
      var st = tstats(s, d.st[0], d.st[1], d.st[2], d.st[3]);
      var cost = tpay(s, d.pay[0], d.pay[1], d.pay[2], d.pay[3], d.pay[4], d.pay[5]);
      var up = upkeep(s, d.up) * 2;
      var dmg = null, note = '', hits = 1, name2 = '';
      var pack = (d.k === 'inu' && s.lv >= 10) ? 1.3 : 1;
      if (d.hit === 'melee') {
        dmg = st.atk * pack; name2 = '攻撃'; note = '呪霊へは' + d.cd + '秒ごと' + (pack > 1 ? '（Lv10連携×1.3）' : '');
        if (d.k === 'gama') note += '／舌：消費 ' + tpay(s, 5, 50, 2, 2, 25, 1) + '・届く ' + Math.min(80, 2 * (s.sous + 16)) + 'ブロック';
      }
      else if (d.hit === 'bolt') { dmg = st.atk; name2 = '雷'; note = '撃つ：' + tpay(s, 5, 80, 5, 2, 40, 2) + '／乗って撃つ：' + tpay(s, 5, 60, 5, 2, 30, 2); }
      else if (d.hit === 'bite') { dmg = st.atk; name2 = '噛みつき'; note = '0.5秒ごと25%'; }
      else if (d.hit === 'sika') { dmg = st.atk; name2 = '反転の放出'; note = '呪霊だけ。味方は回復'; }
      else if (d.hit === 'ushi') {
        var maxd = s.lv >= 5 ? 250 : 300;
        var m = 1 + 9 * Math.min(s.dist, maxd) / maxd;
        dmg = st.atk * m; name2 = s.dist + 'ブロック突進'; note = '最大10倍（' + maxd + 'ブロック）';
      }
      else if (d.hit === 'zou') { dmg = fl(st.atk10 / 2) / 10; name2 = '放水'; note = 'スタンプ ' + fmt(st.atk10 * 5 / 10) + '（半径' + (s.lv >= 5 ? 10 : 8) + '）'; }
      else if (d.k === 'dato') { var n = fl(s.sous / 2) + 10; if (n > 30) n = 30; if (s.lv >= 5) n = Math.min(35, n + 5); note = n + '匹・10秒'; }
      R.push({ name: d.name + (name2 ? '：' + name2 : ''), cost: cost, burn: null, dmg: dmg, hits: hits, range: d.range,
        note: note, hp: st.hp, up: up });
    });
    R.push({ name: '合体（どれか）', cost: oc(s, 200), burn: null, dmg: null, range: '—', note: '2体ともLv5以上' });
    R.push({ name: '調伏の儀（魔虚羅）', cost: tpay(s, 0, 300, 0, 0, 300, 0), burn: null, dmg: null, range: '—', note: '体力800の魔虚羅と戦う' });
    R.push({ name: '領域の影の攻撃', cost: 1500, burn: burn(s, 150, 1), dmg: (20 + 3 * s.jut) / 10, hits: 1, range: '半径18・2体', note: '1秒ごと（嵌合暗翳庭）' });
    R.push({ name: '反転術式', cost: hantenCost(s), burn: null, dmg: null, range: '自分', note: '近くの式神も全回復' });
    return R;
  }

  // ---------- 表示 ----------
  function roman(n) { return ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'][n] || n; }
  function fmt(x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    if (Math.abs(x) >= 100) return String(Math.round(x));
    if (Math.abs(x) >= 10) return (Math.round(x * 10) / 10).toString();
    return (Math.round(x * 100) / 100).toString();
  }
  function esc(t) { return String(t); }

  var state = {
    tech: 'gojo', jut: 5, sous: 0, kek: 0, kek2: 0, jum2: 500, jum: 0, cur: -1, cha: 1, st: 5,
    eye: false, toku2: false, toku4: false, rank: 0, body: false, lv: 1, inRy: false, iji: false, genki: false, dist: 300,
    target: 'j1', mj: -1, jh: 1, zon: false
  };
  var base = null; // 比べる基準

  var $ = function (id) { return document.getElementById(id); };

  function readInputs() {
    function num(id, d) { var v = parseFloat($(id).value); return isNaN(v) ? d : v; }
    state.jut = Math.max(0, fl(num('in-jut', 5)));
    state.sous = Math.max(0, fl(num('in-sous', 0)));
    state.kek = Math.max(0, fl(num('in-kek', 0)));
    state.kek2 = Math.min(state.kek, Math.max(0, fl(num('in-kek2', 0))));
    state.jum2 = Math.max(0, fl(num('in-jum2', 500)));
    state.jum = Math.max(0, fl(num('in-jum', 0)));
    state.st = Math.max(0, fl(num('in-st', 5)));
    state.lv = Math.min(10, Math.max(1, fl(num('in-lv', 1))));
    state.dist = Math.max(0, fl(num('in-dist', 300)));
    var mjv = $('in-mj').value.trim();
    state.mj = mjv === '' ? -1 : Math.max(0, fl(parseFloat(mjv) || 0));
    state.jh = Math.max(0, fl(num('in-jh', 1)));
    state.zon = $('in-zon').checked && state.tech === 'gojo';
    var c = $('in-cur').value.trim();
    state.cur = c === '' ? -1 : Math.max(0, fl(parseFloat(c) || 0));
    state.eye = $('in-eye').checked && state.tech === 'gojo';
    state.toku2 = $('in-toku2').checked && state.tech !== 'tokusa';
    state.toku4 = $('in-toku4').checked && state.tech === 'gojo';
    state.body = $('in-body').checked;
    state.inRy = $('in-ry').checked;
    state.iji = $('in-iji').checked;
    state.genki = $('in-genki').checked;
    state.rank = parseInt($('in-rank').value, 10) || 0;
    state.target = $('in-target').value;
  }

  function rowsFor(s) {
    if (s.tech === 'gojo') return gojoRows(s);
    if (s.tech === 'rika') return rikaRows(s);
    return tokusaRows(s);
  }
  function targetRed(s) {
    for (var i = 0; i < TARGETS.length; i++) if (TARGETS[i].id === s.target) return TARGETS[i].red;
    return 0;
  }

  function diffSpan(now, old, lowerIsBetter) {
    if (old === null || old === undefined || now === null || now === undefined) return '';
    var d = now - old;
    if (Math.abs(d) < 1e-9) return '';
    var good = lowerIsBetter ? d < 0 : d > 0;
    return ' <span class="' + (good ? 'diff-up' : 'diff-down') + '">' + (d > 0 ? '+' : '') + fmt(d) + '</span>';
  }

  function render() {
    readInputs();
    var s = state;
    // 術式ごとの入力の表示切り替え
    document.querySelectorAll('[data-for]').forEach(function (el) {
      var f = el.getAttribute('data-for').split(' ');
      el.style.display = f.indexOf(s.tech) >= 0 ? '' : 'none';
    });

    var mj = maxJu(s);
    var mjR = s.tech === 'rika' ? rikaMaxJu(s) : null;
    var cur = s.cur < 0 ? (mjR || mj) : s.cur;
    var red = targetRed(s);
    var rows = rowsFor(s);
    var baseRows = base ? rowsFor(base) : null;

    // サマリー
    var kb = s.kek - s.kek2;
    var ryCur = cur - 1500;
    var ryHp = ryCur >= 0 ? fl((9000 + ryCur) / 300) + s.sous + 2 * kb : null;
    var ryPush = fl((2 * s.jut + kb) / 4);
    var ryPr = Math.min(30, fl(kb / 2));
    var ryLen = fl((150 + kb) / 2) * 0.5;
    var sum = [
      ['最大呪力', fmt(mj), s.mj >= 0 ? '入力した値' : '基礎×(100+4×倍率)÷100'],
    ];
    if (mjR) sum.push(['リカを出している間', fmt(mjR), '最大呪力']);
    sum.push(['呪力回復', fmt(s.jh * 2) + '/秒', '0から満タンまで 約' + (s.jh > 0 ? fmt((mjR || mj) / (s.jh * 2)) + '秒' : '—')]);
    sum.push(['計算に使う今の呪力', fmt(cur), s.cur < 0 ? (mjR ? '満タン（リカを出している間）' : '満タンとして計算') : '入力した値']);
    sum.push(['反転術式の実質消費', fmt(hantenCost(s)), '1500−呪力操作']);
    sum.push(['領域の体力', ryHp === null ? '呪力不足' : fmt(ryHp), '押し合いで削られる']);
    sum.push(['押し合いの強さ', fmt(ryPush), 'はじめの確率 ' + ryPr + '%']);
    sum.push(['領域の長さ', '約' + fmt(ryLen) + '秒', '結界基礎 ' + kb]);
    if (s.tech === 'rika') {
      sum.push(['リカの最大体力', fmt((5 + s.sous) * 10), '補充時 ' + fmt(Math.min((5 + s.sous) * 10, 3 + 10 * s.sous))]);
      sum.push(['リカの防御力', fmt(RANKS[s.rank].arm), RANKS[s.rank].name]);
    }
    $('summary').innerHTML = sum.map(function (k) {
      return '<div class="k"><span>' + k[0] + '</span><b>' + k[1] + '</b><span>' + k[2] + '</span></div>';
    }).join('');

    // 表
    var isT = s.tech === 'tokusa';
    var h = '<table><tr><th>技</th>' + (isT ? '<th class="num">体力</th><th class="num">維持/秒</th>' : '') +
      '<th class="num">消費呪力</th><th class="num">今の呪力で</th>' + (isT ? '' : '<th class="num">焼き切れ</th>') +
      '<th class="num">ダメージ</th><th class="num">相手へ（−' + red + '%）</th><th class="num">合計の目安</th><th>範囲</th><th>メモ</th></tr>';
    rows.forEach(function (r, i) {
      var b = baseRows ? baseRows[i] : null;
      var real = r.dmg === null || r.dmg === undefined ? null : r.dmg * (1 - red / 100);
      var tot = (real !== null && r.hits) ? real * r.hits : null;
      var times = (r.cost && r.cost > 0) ? fl(cur / r.cost) + '回' : (r.cost === 0 ? '∞' : '—');
      var breal = b && b.dmg !== null && b.dmg !== undefined ? b.dmg * (1 - red / 100) : null;
      var btot = (breal !== null && b && b.hits) ? breal * b.hits : null;
      h += '<tr><td>' + esc(r.name) + '</td>';
      if (isT) {
        h += '<td class="num">' + fmt(r.hp) + diffSpan(r.hp, b && b.hp, false) + '</td>';
        h += '<td class="num">' + (r.up === undefined ? '—' : fmt(r.up)) + diffSpan(r.up, b && b.up, true) + '</td>';
      }
      h += '<td class="num">' + (r.costText && r.cost === null ? r.costText : fmt(r.cost)) + diffSpan(r.cost, b && b.cost, true) + '</td>';
      h += '<td class="num">' + times + '</td>';
      if (!isT) h += '<td class="num">' + fmt(r.burn) + diffSpan(r.burn, b && b.burn, true) + '</td>';
      h += '<td class="num">' + fmt(r.dmg) + (r.unit || '') + diffSpan(r.dmg, b && b.dmg, false) + '</td>';
      h += '<td class="num"><b>' + fmt(real) + '</b>' + (r.unit || '') + diffSpan(real, breal, false) + '</td>';
      h += '<td class="num">' + (tot === null ? '—' : fmt(tot) + (r.hits > 1 ? '<br><small>×' + r.hits + '回</small>' : '')) + diffSpan(tot, btot, false) + (r.hitsEst && tot !== null ? ' <span class="tag est">目安</span>' : '') + '</td>';
      h += '<td>' + esc(r.range || '') + '</td><td>' + (r.note || '') + (r.est ? ' <span class="tag est">目安</span>' : '') + '</td></tr>';
    });
    h += '</table>';
    $('table').innerHTML = h;

    // グラフ
    drawBars('chart-dmg', rows.map(function (r) {
      var real = r.dmg === null || r.dmg === undefined ? null : r.dmg * (1 - red / 100);
      var v = real === null ? null : (r.hits ? real * r.hits : real);
      return { name: r.name, v: v };
    }), '');
    drawBars('chart-cost', rows.map(function (r) { return { name: r.name, v: r.cost }; }), 'alt');

    // 基準の表示
    $('base-info').textContent = base ? '基準：術式' + base.jut + '・操作' + base.sous + '・出力' + roman(base.cha) +
      (base.tech === 'tokusa' ? '・Lv' + base.lv : '') + '（緑＝よくなった／赤＝わるくなった）' : '';
    // URL に残す（共有用）
    try { history.replaceState(null, '', '?t=' + s.tech); } catch (e) {}
  }

  function drawBars(id, items, cls) {
    var vals = items.filter(function (x) { return x.v !== null && x.v !== undefined && !isNaN(x.v); });
    var max = 0;
    vals.forEach(function (x) { if (x.v > max) max = x.v; });
    var h = '';
    vals.forEach(function (x) {
      var w = max > 0 ? Math.max(0.5, x.v / max * 100) : 0;
      h += '<div class="bar-row"><div class="lbl" title="' + x.name + '">' + x.name + '</div><div class="bar-track"><div class="bar-fill ' + cls +
        '" style="width:' + w.toFixed(1) + '%"></div></div><div class="val">' + fmt(x.v) + '</div></div>';
    });
    $(id).innerHTML = h || '<p class="legend">この術式にはダメージの数字がない技だけです。</p>';
  }

  // ---------- 入力のつなぎ ----------
  function bindRangeNumber(rangeId, numId) {
    var r = $(rangeId), n = $(numId);
    r.addEventListener('input', function () { n.value = r.value; render(); });
    n.addEventListener('input', function () {
      var v = parseFloat(n.value);
      if (!isNaN(v)) r.value = Math.min(parseFloat(r.max), v);
      render();
    });
  }

  function init() {
    var sel = $('in-target');
    TARGETS.forEach(function (t) {
      var o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o);
    });
    sel.value = state.target;
    var rk = $('in-rank');
    RANKS.forEach(function (t) {
      var o = document.createElement('option'); o.value = t.id; o.textContent = t.name; rk.appendChild(o);
    });

    [['r-jut', 'in-jut'], ['r-sous', 'in-sous'], ['r-kek', 'in-kek'], ['r-kek2', 'in-kek2'], ['r-jum2', 'in-jum2'],
     ['r-jum', 'in-jum'], ['r-jh', 'in-jh'], ['r-st', 'in-st'], ['r-lv', 'in-lv'], ['r-dist', 'in-dist']].forEach(function (p) { bindRangeNumber(p[0], p[1]); });
    ['in-cur', 'in-mj', 'in-zon', 'in-eye', 'in-toku2', 'in-toku4', 'in-body', 'in-ry', 'in-iji', 'in-genki', 'in-rank', 'in-target'].forEach(function (id) {
      $(id).addEventListener('input', render);
      $(id).addEventListener('change', render);
    });

    document.querySelectorAll('#tech-seg button').forEach(function (b) {
      b.addEventListener('click', function () { setTech(b.getAttribute('data-t')); });
    });
    document.querySelectorAll('#cha-seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.cha = parseInt(b.getAttribute('data-c'), 10);
        document.querySelectorAll('#cha-seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    $('btn-base').addEventListener('click', function () {
      readInputs();
      base = JSON.parse(JSON.stringify(state));
      render();
    });
    $('btn-clear').addEventListener('click', function () { base = null; render(); });
    $('btn-reset').addEventListener('click', function () {
      var d = { 'in-jut': 5, 'in-sous': 0, 'in-kek': 0, 'in-kek2': 0, 'in-jum2': 500, 'in-jum': 0, 'in-jh': 1, 'in-st': 5, 'in-lv': 1, 'in-dist': 300 };
      Object.keys(d).forEach(function (k) { $(k).value = d[k]; $(k.replace('in-', 'r-')).value = d[k]; });
      $('in-cur').value = '';
      $('in-mj').value = '';
      render();
    });

    var m = /[?&]t=(gojo|rika|tokusa)/.exec(location.search);
    setTech(m ? m[1] : 'gojo');
  }
  function setTech(t) {
    state.tech = t;
    if (base && base.tech !== t) base = null;
    document.querySelectorAll('#tech-seg button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-t') === t); });
    render();
  }

  // テスト用に公開
  window.SimCalc = { loss: loss, burn: burn, oc: oc, tpay: tpay, tstats: tstats, maxJu: maxJu, gojoRows: gojoRows, rikaRows: rikaRows, tokusaRows: tokusaRows };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

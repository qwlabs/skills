(function(){
'use strict';

// ===== 侧边栏状态机 =====
// 桌面端(push 模型):
//   展开态 ↔ 收起态 完全由按钮点击驱动 ——
//     收起按钮(.sidebar-close-btn,在 sidebar header 内)→ setNarrow()
//     展开按钮(.sidebar-open-btn,收起后凸出在左缘)→ setExpanded()
//   不再用 mouseleave 自动收起,避免读正文时误收起打断导航。
//   拖拽右边缘手柄调整宽度,会话内保留(不跨会话持久化)。
// 移动端:汉堡按钮切换全宽覆盖层(hover 逻辑用 @media(hover:hover) 限定,触屏不走)。

var sidebar, main, resizer, openBtn, closeBtn;
var currentWidth = 0;        // 会话内生效宽度(px),拖拽后更新
var MIN_W = 200, MAX_W = 560, DEFAULT_MAX = 380;

function isDesktop(){ return window.matchMedia('(hover:hover) and (min-width:769px)').matches; }

// 首帧测默认宽度 = min(max-content, DEFAULT_MAX),visibility:hidden 防闪烁,加载后 JS 覆盖。
// 注意:测量用的临时 inline width 测完必须清空 —— 否则会压过 .sidebar.narrow 的 width:8px
// (inline style 优先级高于 class),导致收起时侧边栏还是测量宽度的一整块背景。
function measureDefaultWidth(){
  if(!sidebar) return;
  sidebar.style.visibility = 'hidden';
  sidebar.style.width = 'max-content';
  var measured = sidebar.offsetWidth;
  var w = Math.max(MIN_W, Math.min(measured, DEFAULT_MAX));
  currentWidth = w;
  sidebar.style.width = '';   // 清掉测量 inline width,宽度统一交给 --sidebar-w 变量
  sidebar.style.visibility = '';
  document.documentElement.style.setProperty('--sidebar-w', w + 'px');
}

// 收起:sidebar 用 translateX(-100%) 整体平移出视口(不改 width,内部元素不伸缩),
// main 回到满宽;宽度 --sidebar-w 不动,展开时正文向右推的距离仍是 currentWidth。
function setNarrow(){
  if(!sidebar || !isDesktop()) return;
  sidebar.classList.add('narrow');
  main.classList.add('expanded');
  resizer.classList.add('narrow');
}

function setExpanded(){
  if(!sidebar || !isDesktop()) return;
  sidebar.classList.remove('narrow');
  main.classList.remove('expanded');
  resizer.classList.remove('narrow');
  var w = currentWidth || parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 260;
  document.documentElement.style.setProperty('--sidebar-w', w + 'px');
}

function armNarrowTimer(){ /* 已弃用自动收起,保留空函数避免外部引用报错 */ }
function cancelNarrowTimer(){ /* noop */ }

// 收起/展开入口:均由按钮点击驱动(见 .sidebar-close-btn / .sidebar-open-btn)。
window.collapseSidebar = function(){ setNarrow(); };
window.expandSidebar = function(){ setExpanded(); };

function bindInteractions(){
  // 收起/展开完全由 onclick 按钮驱动,这里暂无额外绑定(留作键盘快捷键等扩展位)。
  if(!isDesktop()) return;
}

// ===== 拖拽手柄 =====
function bindResizer(){
  var startX = 0, startW = 0;
  resizer.addEventListener('mousedown', function(e){
    if(sidebar.classList.contains('narrow')) return;     // narrow 态不拖
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  function onMove(e){
    var w = Math.max(MIN_W, Math.min(startW + (e.clientX - startX), MAX_W));
    currentWidth = w;
    document.documentElement.style.setProperty('--sidebar-w', w + 'px');
  }
  function onUp(){
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }
}

// ===== 移动端汉堡按钮 =====
window.toggleMobileSidebar = function(){
  sidebar.classList.toggle('mobile-open');
};

// 移动端:点选菜单项后自动关闭覆盖层
function bindMobileNav(){
  sidebar.querySelectorAll('.toc a').forEach(function(a){
    a.addEventListener('click', function(){
      if(window.matchMedia('(max-width:768px)').matches){
        sidebar.classList.remove('mobile-open');
      }
    });
  });
}

// ===== 初始化 =====
function initSidebar(){
  sidebar = document.querySelector('.sidebar');
  main = document.querySelector('.main');
  resizer = document.querySelector('.sidebar-resizer');
  openBtn = document.querySelector('.sidebar-open-btn');
  closeBtn = document.querySelector('.sidebar-close-btn');
  if(!sidebar || !main || !resizer) return;

  if(isDesktop()){
    measureDefaultWidth();
    setExpanded();
    bindInteractions();
    bindResizer();
  }
  bindMobileNav();
}

// ===== TOC 高亮(沿用原逻辑) =====
function highlightToc(e){
  document.querySelectorAll('.toc-link').forEach(function(l){ l.classList.remove('active'); });
  if(e) e.classList.add('active');
}

document.querySelectorAll('.toc-link').forEach(function(l){
  l.addEventListener('click', function(){ highlightToc(this); });
});

var observer = new IntersectionObserver(function(entries){
  entries.forEach(function(entry){
    if(entry.isIntersecting){
      var id = entry.target.id;
      document.querySelectorAll('.toc-link').forEach(function(l){ l.classList.remove('active'); });
      var activeLink = document.querySelector('.toc-link[href="#' + id + '"]');
      if(activeLink) activeLink.classList.add('active');
    }
  });
});
document.querySelectorAll('.doc-card').forEach(function(s){ observer.observe(s); });

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('pre code').forEach(function(block){ hljs.highlightElement(block); });
  initSidebar();
});

// ===== 示例区 tab/复制(沿用原逻辑) =====
window.switchExampleTab = function(btn, paneId){
  var section = btn.closest('.example-section');
  section.querySelectorAll('.example-tab').forEach(function(t){ t.classList.remove('active'); });
  btn.classList.add('active');
  section.querySelectorAll('.example-pane').forEach(function(p){ p.classList.remove('active'); });
  document.getElementById(paneId).classList.add('active');
  var pane = document.getElementById(paneId);
  pane.querySelectorAll('.example-card-tab').forEach(function(t){ t.classList.remove('active'); });
  var reqTab = pane.querySelector('.tab-request');
  if(reqTab){ reqTab.classList.add('active'); }
  pane.querySelectorAll('.example-card-content').forEach(function(c){ c.classList.remove('active'); });
  pane.querySelector('.example-card-content').classList.add('active');
};
window.switchCardTab = function(btn, contentId){
  var card = btn.closest('.example-card');
  card.querySelectorAll('.example-card-tab').forEach(function(t){ t.classList.remove('active'); });
  btn.classList.add('active');
  card.querySelectorAll('.example-card-content').forEach(function(c){ c.classList.remove('active'); });
  document.getElementById(contentId).classList.add('active');
  var codeEl = document.getElementById(contentId).querySelector('code');
  if(codeEl && !codeEl.classList.contains('hljs')){ hljs.highlightElement(codeEl); }
};
window.copyCard = function(btn){
  var body = btn.closest('.example-card-body');
  var active = body.querySelector('.example-card-content.active');
  var code = active.querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(function(){
    btn.textContent = '已复制';
    setTimeout(function(){ btn.textContent = '复制'; }, 1500);
  });
};
// ===== 联合类型变体 tab（union payload，支持任意层嵌套） =====
// 每层 union 一组 tab，按钮带 data-union-variant="<gid>-<i>"。
// 每行 .union-variant 带 data-union-group（空格分隔多个 "<gid>-<i>"），表示
// 「该行同时归属这些变体分支」——嵌套时是内层变体 + 各祖先变体的并集。
// 一行可见 ⟺ 其 data-union-group 中每个 token 对应的 tab 都 active。
// 点 tab：切本组 active，然后重算卡片内所有 .union-variant 的可见性。
document.addEventListener('click', function(e){
  var btn = e.target.closest && e.target.closest('.union-tab');
  if(!btn || !btn.dataset.unionVariant) return;
  var key = btn.dataset.unionVariant;                          // "<gid>-<i>"
  var gid = key.split('-')[0];
  var host = btn.closest('[data-union-tabs]');
  host.querySelectorAll('.union-tab').forEach(function(t){
    t.classList.toggle('active', t === btn);
  });
  var card = btn.closest('.doc-card');
  if(!card) return;
  // tab active 表：<gid>-<i> → 是否 active
  var activeMap = {};
  card.querySelectorAll('.union-tab').forEach(function(t){
    activeMap[t.dataset.unionVariant] = t.classList.contains('active');
  });
  card.querySelectorAll('.union-variant').forEach(function(r){
    // 仅处理直接属于本 gid 的行（其最内 group token 归本 gid 管理）。
    var groups = (r.dataset.unionGroup || '').trim().split(/\s+/);
    var mine = groups.some(function(g){ return g.split('-')[0] === gid; });
    if(!mine) return;
    // 可见 ⟺ 每个归属 group 对应的 tab 都 active。
    var visible = groups.every(function(g){ return activeMap[g]; });
    r.classList.toggle('active', visible);
  });
});

})();
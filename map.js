// ===== 初始化 =====
let chart = null;
let spotsData = [];
let visitedSet = new Set();
let currentProvince = 'all';

// 页面上显示状态
function showStatus(msg, isError) {
  const c = document.getElementById('map-container');
  c.innerHTML = `<div style="color:${isError?'#ff6b6b':'#ffd700'};text-align:center;padding-top:200px;font-size:18px;">${msg}</div>`;
}

// ===== 加载数据 =====
async function loadData() {
  try {
    showStatus('加载地图数据中...', false);

    // 加载 GeoJSON
    const geoRes = await fetch('data/china.json');
    if (!geoRes.ok) throw new Error('china.json 加载失败: ' + geoRes.status);
    const geoJson = await geoRes.json();
    echarts.registerMap('china', geoJson);

    // 加载景区数据
    const spotsRes = await fetch('data/5a-spots.json');
    if (!spotsRes.ok) throw new Error('5a-spots.json 加载失败: ' + spotsRes.status);
    spotsData = await spotsRes.json();

    // 从 localStorage 恢复打卡记录
    const saved = localStorage.getItem('visited-5a-spots');
    if (saved) {
      visitedSet = new Set(JSON.parse(saved));
    }

    // 填充省份筛选下拉框
    const provinces = [...new Set(spotsData.map(function(s) { return s.province; }))].sort();
    const select = document.getElementById('province-filter');
    provinces.forEach(function(p) {
      const option = document.createElement('option');
      option.value = p;
      option.textContent = p;
      select.appendChild(option);
    });

    select.addEventListener('change', function(e) {
      currentProvince = e.target.value;
      renderMap();
    });

    // 重置按钮
    document.getElementById('reset-btn').addEventListener('click', function() {
      if (confirm('确定要清除所有打卡记录吗？此操作不可撤销。')) {
        visitedSet.clear();
        localStorage.removeItem('visited-5a-spots');
        updateStats();
        renderMap();
      }
    });

    return true;
  } catch (err) {
    showStatus('❌ 数据加载失败: ' + err.message, true);
    console.error(err);
    return false;
  }
}

// ===== 更新统计栏 =====
function updateStats() {
  var total = spotsData.length;
  var visited = visitedSet.size;
  document.getElementById('visited-count').textContent = visited;
  document.getElementById('progress-text').textContent =
    Math.round(visited / total * 100) + '%';
  document.getElementById('progress-fill').style.width =
    (visited / total * 100) + '%';
}

// ===== 竖排文字（每字换行） =====
function verticalName(name) {
  return name.split('').join('\n');
}

// ===== 渲染地图 =====
function renderMap() {
  try {
    if (!chart) {
      var container = document.getElementById('map-container');
      container.innerHTML = '';  // 清除状态文字
      chart = echarts.init(container);
    }

    // 筛选数据
    var filtered = spotsData;
    if (currentProvince !== 'all') {
      filtered = spotsData.filter(function(s) { return s.province === currentProvince; });
    }

    // 分开已打卡和未打卡
    var visited = filtered.filter(function(s) { return visitedSet.has(s.name); });
    var unvisited = filtered.filter(function(s) { return !visitedSet.has(s.name); });

    // 构建地域高亮
    var regionsOption = [];
    if (currentProvince !== 'all') {
      regionsOption.push({
        name: currentProvince,
        selected: true,
        itemStyle: {
          areaColor: '#1a3050',
          borderColor: '#ffd700',
          borderWidth: 2
        },
        label: {
          show: true,
          color: '#ffd700',
          fontSize: 16
        }
      });
    }

    var option = {
      backgroundColor: '#1a1a2e',

      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
            var d = params.data;
            return '<b>' + d.name + '</b><br/>' +
                   '📍 ' + d.location + '<br/>' +
                   '状态: ' + (visitedSet.has(d.name) ? '✅ 已打卡' : '⬜ 未打卡') + '<br/>' +
                   '<span style="color:#aaa;font-size:12px;">点击切换打卡状态</span>';
          }
          return params.name || '';
        }
      },

      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [104.5, 36],
        scaleLimit: { min: 0.5, max: 30 },
        zoomLock: false,
        silent: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, color: '#fff' },
          itemStyle: { areaColor: '#2a3a5c' }
        },
        itemStyle: {
          areaColor: '#16213e',
          borderColor: '#304878',
          borderWidth: 1.5
        },
        regions: regionsOption
      },

      series: [
        // 未打卡景区 — 灰色
        {
          type: 'scatter',
          coordinateSystem: 'geo',
          data: unvisited.map(function(s) {
            return {
              name: s.name,
              value: [s.lng, s.lat],
              location: s.location,
              province: s.province
            };
          }),
          symbolSize: 6,
          symbol: 'circle',
          itemStyle: {
            color: '#555',
            borderColor: '#777',
            borderWidth: 1,
            opacity: 0.5
          },
          label: {
            show: true,
            position: 'top',
            formatter: function(p) { return verticalName(p.name); },
            color: '#666',
            fontSize: 9,
            distance: 5
          },
          emphasis: {
            scale: 2,
            itemStyle: { color: '#999', opacity: 1 },
            label: { color: '#ccc', fontSize: 11 }
          },
          zlevel: 1
        },

        // 已打卡景区 — 金色
        {
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: visited.map(function(s) {
            return {
              name: s.name,
              value: [s.lng, s.lat],
              location: s.location,
              province: s.province
            };
          }),
          symbolSize: 10,
          symbol: 'circle',
          showEffectOn: 'emphasis',
          rippleEffect: {
            brushType: 'stroke',
            scale: 3,
            period: 3,
            color: '#ffd700'
          },
          itemStyle: {
            color: '#ffd700',
            shadowColor: '#ffd700',
            shadowBlur: 15,
            borderColor: '#ffaa00',
            borderWidth: 2
          },
          label: {
            show: true,
            position: 'top',
            formatter: function(p) { return verticalName(p.name); },
            color: '#ffd700',
            fontSize: 10,
            fontWeight: 'bold',
            distance: 7
          },
          emphasis: {
            scale: 2,
            itemStyle: { shadowBlur: 30, shadowColor: '#ffd700' },
            label: { fontSize: 13 }
          },
          zlevel: 2
        }
      ]
    };

    chart.setOption(option, true);

    // 点击事件
    chart.off('click');
    chart.on('click', function(params) {
      if (params.seriesType === 'scatter' || params.seriesType === 'effectScatter') {
        var name = params.data.name;
        if (visitedSet.has(name)) {
          visitedSet.delete(name);
        } else {
          visitedSet.add(name);
        }
        localStorage.setItem('visited-5a-spots', JSON.stringify(Array.from(visitedSet)));
        updateStats();
        renderMap();
      }
    });

    // 省份筛选时自动定位
    if (currentProvince !== 'all') {
      var provSpots = spotsData.filter(function(s) { return s.province === currentProvince; });
      if (provSpots.length > 0) {
        var lngs = provSpots.map(function(s) { return s.lng; });
        var lats = provSpots.map(function(s) { return s.lat; });
        var cLng = (Math.min.apply(null, lngs) + Math.max.apply(null, lngs)) / 2;
        var cLat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2;
        chart.setOption({
          geo: { center: [cLng, cLat], zoom: 1.5 }
        });
      }
    }

    updateStats();
  } catch (err) {
    console.error('渲染错误:', err);
    showStatus('❌ 地图渲染失败: ' + err.message, true);
  }
}

// ===== 缩放控制按钮 =====
function createZoomControls() {
  var container = document.getElementById('map-container');

  // 按钮容器
  var ctrl = document.createElement('div');
  ctrl.id = 'zoom-controls';
  ctrl.innerHTML = `
    <button id="zoom-in" title="放大 (滚轮/+)">＋</button>
    <div class="zoom-divider"></div>
    <button id="zoom-out" title="缩小 (滚轮/-)">－</button>
    <div class="zoom-divider"></div>
    <button id="zoom-reset" title="重置视图">⟳</button>
  `;
  container.appendChild(ctrl);

  // 放大
  document.getElementById('zoom-in').addEventListener('click', function() {
    if (!chart) return;
    var opt = chart.getOption();
    var zoom = opt.geo[0].zoom || 1.2;
    chart.setOption({ geo: { zoom: Math.min(zoom * 1.8, 30) } });
  });

  // 缩小
  document.getElementById('zoom-out').addEventListener('click', function() {
    if (!chart) return;
    var opt = chart.getOption();
    var zoom = opt.geo[0].zoom || 1.2;
    chart.setOption({ geo: { zoom: Math.max(zoom / 1.8, 0.5) } });
  });

  // 重置
  document.getElementById('zoom-reset').addEventListener('click', function() {
    if (!chart) return;
    chart.setOption({
      geo: { zoom: 1.2, center: [104.5, 36] }
    });
  });
}

// ===== 键盘快捷键 =====
document.addEventListener('keydown', function(e) {
  if (!chart) return;
  // 只在地图有焦点或没有输入框焦点时响应
  var tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  var opt = chart.getOption();
  if (!opt.geo || !opt.geo[0]) return;
  var zoom = opt.geo[0].zoom || 1.2;

  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    chart.setOption({ geo: { zoom: Math.min(zoom * 1.5, 30) } });
  } else if (e.key === '-') {
    e.preventDefault();
    chart.setOption({ geo: { zoom: Math.max(zoom / 1.5, 0.5) } });
  } else if (e.key === '0') {
    e.preventDefault();
    chart.setOption({ geo: { zoom: 1.2, center: [104.5, 36] } });
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    var c = opt.geo[0].center || [104.5, 36];
    chart.setOption({ geo: { center: [c[0], c[1] + 2 / zoom] } });
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    var c = opt.geo[0].center || [104.5, 36];
    chart.setOption({ geo: { center: [c[0], c[1] - 2 / zoom] } });
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    var c = opt.geo[0].center || [104.5, 36];
    chart.setOption({ geo: { center: [c[0] - 2 / zoom, c[1]] } });
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    var c = opt.geo[0].center || [104.5, 36];
    chart.setOption({ geo: { center: [c[0] + 2 / zoom, c[1]] } });
  }
});

// ===== 窗口大小自适应 =====
window.addEventListener('resize', function() {
  if (chart) chart.resize();
});

// ===== 启动 =====
loadData().then(function(ok) {
  if (ok) {
    createZoomControls();
    renderMap();
  }
});

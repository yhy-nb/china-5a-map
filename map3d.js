// ===== 密码锁 =====
(function(){
  if (sessionStorage.getItem('unlocked')) return;
  document.getElementById('lock-btn').addEventListener('click',function(){
    var pwd=document.getElementById('lock-input').value;
    // 修改这里设置你的密码 (默认: 123456)
    if(pwd==='123456'){
      sessionStorage.setItem('unlocked','1');
      document.getElementById('lock-screen').classList.add('hidden');
    }else{
      document.getElementById('lock-error').textContent='密码错误';
    }
  });
  document.getElementById('lock-input').addEventListener('keydown',function(e){
    if(e.key==='Enter') document.getElementById('lock-btn').click();
  });
})();

var chart = null;
var spotsData = [];
var visitedMap = {};
var currentProvince = 'all';
var currentSpot = null;

// ===== 数据 =====
function visited(name) { return !!(visitedMap[name] && visitedMap[name].checked); }
function vCount() { return Object.values(visitedMap).filter(function(v){return v.checked;}).length; }

function loadVisited() {
  var raw = localStorage.getItem('visited-5a-spots');
  if (!raw) { visitedMap = {}; return; }
  try {
    var d = JSON.parse(raw);
    if (Array.isArray(d)) {
      var m = {}; d.forEach(function(n){ m[n] = {checked:true,date:'',comment:'',images:[]}; });
      visitedMap = m;
    } else { visitedMap = d || {}; }
  } catch(e) { visitedMap = {}; }
}
function saveVisited() { localStorage.setItem('visited-5a-spots', JSON.stringify(visitedMap)); }

// ===== 图片压缩 =====
function compressImg(file) {
  return new Promise(function(resolve, reject) {
    if (!file.type.match(/image\//)) return reject('非图片文件');
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      var w = img.width, h = img.height;
      if (w > 600) { h = Math.round(h * 600 / w); w = 600; }
      var cvs = document.createElement('canvas'); cvs.width = w; cvs.height = h;
      cvs.getContext('2d').drawImage(img, 0, 0, w, h);
      var b64 = cvs.toDataURL('image/webp', 0.7);
      if (b64.indexOf('data:image/webp') !== 0) b64 = cvs.toDataURL('image/jpeg', 0.7);
      if (b64.length > 210000) reject('压缩后超过200KB'); else resolve(b64);
    };
    img.onerror = function() { reject('加载失败'); };
    img.src = url;
  });
}

// ===== 弹窗 =====
function openModal(spot) {
  currentSpot = spot;
  var v = visited(spot.name), d = visitedMap[spot.name] || {};
  document.getElementById('spot-modal-title').textContent = spot.name;
  document.getElementById('spot-modal-location').textContent = '📍 ' + (spot.location || '');
  document.getElementById('spot-modal-date').textContent = (v && d.date) ? '🕐 ' + d.date : '';

  if (v) {
    document.getElementById('spot-modal-checkin').style.display = 'none';
    document.getElementById('spot-modal-editor').classList.add('show');
    document.getElementById('spot-comment').value = d.comment || '';
    renderThumbs(d.images || []);
  } else {
    document.getElementById('spot-modal-checkin').style.display = 'block';
    document.getElementById('spot-modal-editor').classList.remove('show');
  }
  document.getElementById('spot-modal-overlay').classList.add('show');
  document.getElementById('spot-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('spot-modal-overlay').classList.remove('show');
  document.getElementById('spot-modal').classList.remove('show');
  document.getElementById('spot-save-msg').textContent = '';
  currentSpot = null;
}

function renderThumbs(imgs) {
  var c = document.getElementById('spot-images-preview'); c.innerHTML = '';
  imgs.forEach(function(b64, i) {
    var div = document.createElement('div'); div.className = 'spot-thumb';
    var im = document.createElement('img'); im.src = b64; im.title = '点击放大';
    im.addEventListener('click', function() { lightbox(b64); });
    var del = document.createElement('button'); del.className = 'del-btn'; del.textContent = '×';
    del.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentSpot || !visited(currentSpot.name)) return;
      visitedMap[currentSpot.name].images.splice(i, 1);
      saveVisited(); renderThumbs(visitedMap[currentSpot.name].images);
      updatePanel();
    });
    div.appendChild(im); div.appendChild(del); c.appendChild(div);
  });
}

function lightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('show');
}

// ===== 初始化 =====
async function loadData() {
  try {
    var geoRes = await fetch('data/china.json');
    echarts.registerMap('china', await geoRes.json());
    var spotsRes = await fetch('data/5a-spots.json');
    spotsData = await spotsRes.json();
    loadVisited();

    var provs = spotsData.map(function(s){return s.province;}).filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
    var sel = document.getElementById('province-filter');
    provs.forEach(function(p){var o=document.createElement('option');o.value=p;o.textContent=p;sel.appendChild(o);});
    sel.addEventListener('change', function(){currentProvince=sel.value;renderMap();});

    // 已打卡面板
    document.getElementById('visited-list-btn').addEventListener('click', function(){
      var p = document.getElementById('visited-panel');
      p.classList.toggle('open'); if (p.classList.contains('open')) updatePanel();
    });
    document.getElementById('visited-panel-close').addEventListener('click', function(){
      document.getElementById('visited-panel').classList.remove('open');
    });
    document.getElementById('reset-btn').addEventListener('click', function(){
      if (confirm('确定清除所有打卡记录？')) { visitedMap={}; saveVisited(); updateStats(); renderMap(); updatePanel(); }
    });

    // 弹窗事件
    document.getElementById('spot-modal-close').addEventListener('click', closeModal);
    document.getElementById('spot-modal-overlay').addEventListener('click', closeModal);
    document.getElementById('spot-modal-checkin-btn').addEventListener('click', function(){
      if (!currentSpot) return;
      visitedMap[currentSpot.name] = {checked:true, date:new Date().toISOString().slice(0,10), comment:'', images:[]};
      saveVisited(); updateStats(); renderMap(); updatePanel(); openModal(currentSpot);
    });
    document.getElementById('spot-save-btn').addEventListener('click', function(){
      if (!currentSpot) return;
      visitedMap[currentSpot.name].comment = document.getElementById('spot-comment').value;
      saveVisited();
      document.getElementById('spot-save-msg').textContent = '✅ 已保存';
      setTimeout(function(){document.getElementById('spot-save-msg').textContent='';}, 1500);
      updatePanel();
    });
    document.getElementById('lightbox-close').addEventListener('click', function(){
      document.getElementById('lightbox').classList.remove('show');
    });
    document.getElementById('lightbox').addEventListener('click', function(e){
      if (e.target === this) this.classList.remove('show');
    });

    // 上传
    var fi = document.getElementById('spot-file-input');
    document.getElementById('spot-upload-btn').addEventListener('click', function(){
      if (!currentSpot || !visited(currentSpot.name)) { alert('请先点亮打卡'); return; }
      if ((visitedMap[currentSpot.name].images||[]).length >= 3) { alert('最多3张'); return; }
      fi.value = ''; fi.click();
    });
    fi.addEventListener('change', function(){
      if (!currentSpot || !visited(currentSpot.name)) return;
      var d = visitedMap[currentSpot.name];
      var files = Array.from(fi.files), rem = 3 - (d.images||[]).length;
      if (files.length > rem) { alert('最多还能添加 '+rem+' 张'); return; }
      Promise.all(files.map(compressImg)).then(function(r){
        if (!d.images) d.images = [];
        r.forEach(function(b){d.images.push(b);});
        saveVisited(); renderThumbs(d.images); updatePanel();
      }).catch(function(e){alert(e);});
    });

    return true;
  } catch(e) { console.error(e); return false; }
}

// ===== 渲染 =====
function updateStats() {
  var v = vCount(), t = spotsData.length;
  document.getElementById('visited-count').textContent = v;
  document.getElementById('progress-text').textContent = Math.round(v/t*100) + '%';
  document.getElementById('progress-fill').style.width = (v/t*100) + '%';
}

function renderMap() {
  if (!chart) {
    var mc = document.getElementById('map-container');
    mc.innerHTML = '';
    if (mc.offsetHeight < 100) mc.style.minHeight = '500px';
    chart = echarts.init(mc);
  }

  var f = spotsData;
  if (currentProvince !== 'all') f = f.filter(function(s){return s.province===currentProvince;});
  var visitedList = f.filter(function(s){return visited(s.name);});
  var unvisitedList = f.filter(function(s){return !visited(s.name);});

  chart.setOption({
    backgroundColor: '#add8e6',
    tooltip: {
      trigger: 'item',
      formatter: function(p) {
        if (p.seriesType==='scatter'||p.seriesType==='effectScatter')
          return '<b>'+p.data.name+'</b><br/>📍 '+p.data.location+'<br/>'+(visited(p.data.name)?'✅ 已打卡':'⬜ 未打卡');
        return '';
      }
    },
    geo: {
      map: 'china', roam: true, zoom: 1.2, center: [104.5, 36],
      scaleLimit: {min:0.5,max:80}, label: {show:false},
      emphasis: {label:{show:true,color:'#fff',fontSize:14}, itemStyle:{areaColor:'#c8f0c8'}},
      itemStyle: {areaColor:'#90ee90', borderColor:'#333', borderWidth: 0.5}
    },
    series: [
      {
        type: 'scatter', coordinateSystem: 'geo', name: '未打卡',
        data: unvisitedList.map(function(s){return{name:s.name,value:[s.lng,s.lat],location:s.location};}),
        symbolSize: 12, symbol: 'circle',
        itemStyle: {color:'rgba(180,180,180,0.15)',borderColor:'#aaa',borderWidth:2,shadowBlur:4,shadowColor:'rgba(0,0,0,0.3)',shadowOffsetY:2},
        label: {show:true,formatter:'{b}',position:'top',color:'#999',fontSize:11,distance:5,fontFamily:'MiSans'},
        emphasis: {scale:1.4,itemStyle:{borderColor:'#ccc',color:'rgba(200,200,200,0.3)'},label:{fontSize:15,color:'#ccc'}}
      },
      {
        type: 'effectScatter', coordinateSystem: 'geo', name: '已打卡',
        data: visitedList.map(function(s){return{name:s.name,value:[s.lng,s.lat],location:s.location};}),
        symbolSize: 16, symbol: 'circle', showEffectOn: 'render',
        rippleEffect: {brushType:'fill',scale:3,period:3.5,color:'rgba(212,175,55,0.2)'},
        itemStyle: {color:'#D4AF37',borderColor:'#f0d060',borderWidth:1.5,shadowBlur:12,shadowColor:'rgba(212,175,55,0.3)',shadowOffsetY:2},
        label: {show:true,formatter:'{b}',position:'top',color:'#c9a030',fontSize:12,distance:6,fontWeight:'bold',fontFamily:'MiSans'},
        emphasis: {scale:1.5,itemStyle:{color:'#e8c840',shadowBlur:20},label:{fontSize:17,color:'#D4AF37'}}
      }
    ]
  }, true);

  chart.off('click');
  chart.on('click', function(p) {
    if ((p.seriesType==='scatter'||p.seriesType==='effectScatter') && p.data && p.data.name) {
      var s = spotsData.find(function(x){return x.name===p.data.name;});
      if (s) openModal(s);
    }
  });

  if (currentProvince !== 'all') {
    var ps = spotsData.filter(function(s){return s.province===currentProvince;});
    if (ps.length) {
      var lngs = ps.map(function(s){return s.lng;}), lats = ps.map(function(s){return s.lat;});
      chart.setOption({geo:{center:[(Math.min.apply(null,lngs)+Math.max.apply(null,lngs))/2,(Math.min.apply(null,lats)+Math.max.apply(null,lats))/2],zoom:3}});
    }
  }
  updateStats();
}

function updatePanel() {
  var list = document.getElementById('visited-panel-list');
  var vSpots = spotsData.filter(function(s){return visited(s.name);});
  document.getElementById('visited-list-count').textContent = vSpots.length;
  if (!vSpots.length) { list.innerHTML = '<div class="empty">还没有打卡记录<br/>点击地图上的景点开始打卡吧 ✨</div>'; return; }

  var groups = {};
  vSpots.forEach(function(s){ if(!groups[s.province]) groups[s.province]=[]; groups[s.province].push(s); });
  var html = '';
  Object.keys(groups).sort().forEach(function(prov){
    html += '<div style="color:#888;font-size:11px;padding:8px 10px 4px;">'+prov+'</div>';
    groups[prov].forEach(function(s){
      var d = visitedMap[s.name] || {};
      html += '<div class="spot-item" data-name="'+s.name.replace(/"/g,'&quot;')+'">'+
        '<span class="spot-dot"></span><div style="flex:1"><span class="spot-name">'+s.name+'</span>'+
        (d.comment ? '<div class="spot-comment-preview">'+d.comment.substring(0,20)+'</div>' : '')+
        '</div>'+
        (d.images&&d.images.length ? '<span class="spot-images-badge">🖼'+d.images.length+'</span>' : '')+
        '<span class="spot-province">'+s.city+'</span></div>';
    });
  });
  list.innerHTML = html;
  list.querySelectorAll('.spot-item').forEach(function(el){
    el.addEventListener('click', function(){
      var n = this.getAttribute('data-name');
      var s = spotsData.find(function(x){return x.name===n;});
      if (s&&chart) { chart.setOption({geo:{center:[s.lng,s.lat],zoom:8}}); }
      document.getElementById('visited-panel').classList.remove('open');
    });
  });
}

window.addEventListener('resize', function(){ if (chart) chart.resize(); });
loadData().then(function(ok){ if (ok) renderMap(); }).catch(function(e){
  document.getElementById('map-container').innerHTML = '<div style="color:#f66;text-align:center;padding-top:200px;font-size:18px;">❌ 加载失败: '+e.message+'</div>';
});

function toggleSidebar(){
    const sidebar=document.querySelector('.sidebar');
    const main=document.querySelector('.main');
    const floatingBtn=document.querySelector('.sidebar-toggle-floating');
    const inlineBtn=document.querySelector('.sidebar-toggle-inline');
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
    const isCollapsed=sidebar.classList.contains('collapsed');
    floatingBtn.textContent=isCollapsed?'→':'←';
    inlineBtn.textContent=isCollapsed?'→':'←';
    if(isCollapsed){
        floatingBtn.classList.add('visible');
        inlineBtn.style.display='none'
    }else{
        floatingBtn.classList.remove('visible');
        inlineBtn.style.display='block'
    }
    localStorage.setItem('sidebarCollapsed',isCollapsed)
}
function highlightToc(e){
    document.querySelectorAll('.toc-link').forEach(l=>l.classList.remove('active'));
    e.classList.add('active')
}
document.querySelectorAll('.toc-link').forEach(l=>{
    l.addEventListener('click',function(){
        highlightToc(this)
    })
});
const observer=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
        if(entry.isIntersecting){
            const id=entry.target.id;
            document.querySelectorAll('.toc-link').forEach(l=>l.classList.remove('active'));
            const activeLink=document.querySelector('.toc-link[href="#'+id+'"]');
            if(activeLink)activeLink.classList.add('active')
        }
    })
});
document.querySelectorAll('.api-section').forEach(s=>observer.observe(s));
document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('pre code').forEach(function(block){hljs.highlightElement(block)});
    const collapsed=localStorage.getItem('sidebarCollapsed')==='true';
    const sidebar=document.querySelector('.sidebar');
    const main=document.querySelector('.main');
    const floatingBtn=document.querySelector('.sidebar-toggle-floating');
    const inlineBtn=document.querySelector('.sidebar-toggle-inline');
    floatingBtn.textContent=collapsed?'→':'←';
    inlineBtn.textContent=collapsed?'→':'←';
    if(collapsed){
        sidebar.classList.add('collapsed');
        main.classList.add('expanded');
        floatingBtn.classList.add('visible');
        inlineBtn.style.display='none'
    }else{
        floatingBtn.classList.remove('visible');
        inlineBtn.style.display='block'
    }
});

import { createElement, Terminal, SquareTerminal, Command, Plus, Minus, Square, X, Search, Settings2, BookmarkPlus, Bookmark, Layers, FolderSync, Folder, FolderOpen, File, FileCode2, FileJson, FileText, FileImage, FileArchive, FilePenLine, FolderUp, FolderPlus, Folders, Monitor, Upload, Download, ArrowUp, ArrowDown, CornerDownLeft, RefreshCw, RotateCw, Save, Eraser, Columns2, PanelRight, PanelLeft, Server, ServerCog, MoreHorizontal, Pencil, Pin, PinOff, Trash2, ExternalLink, KeyRound, ChevronRight, Sparkles, History, ChevronDown, ChevronsRight, Braces, Globe, HardDrive } from 'lucide';
const nodes={Terminal,SquareTerminal,Command,Plus,Minus,Square,X,Search,Settings2,BookmarkPlus,Bookmark,Layers,FolderSync,Folder,FolderOpen,File,FileCode2,FileJson,FileText,FileImage,FileArchive,FilePenLine,FolderUp,FolderPlus,Folders,Monitor,Upload,Download,ArrowUp,ArrowDown,CornerDownLeft,RefreshCw,RotateCw,Save,Eraser,Columns2,PanelRight,PanelLeft,Server,ServerCog,MoreHorizontal,Pencil,Pin,PinOff,Trash2,ExternalLink,KeyRound,ChevronRight,Sparkles,History,ChevronDown,ChevronsRight,Braces,Globe,HardDrive};
const cache=new Map();
export function icon(name){
  if(!cache.has(name)){
    const key=name.replace(/(^|-)([a-z0-9])/g,(_,sep,c)=>c.toUpperCase());
    cache.set(name,createElement(nodes[key]||File,{class:'ui-icon icon-'+name,'aria-hidden':'true','stroke-width':1.8}).outerHTML);
  }
  return cache.get(name);
}
export function paintIcons(root=document){root.querySelectorAll('i[data-lucide]').forEach(el=>{el.outerHTML=icon(el.dataset.lucide);});}
export function shellIcon(shell){const s=shell.toLowerCase();return s.includes('pwsh')||s.includes('powershell')?`<span class="shell-icon powershell">${icon('terminal')}</span>`:s.includes('wsl')?`<span class="shell-icon linux">${icon('braces')}</span>`:`<span class="shell-icon cmd">${icon('square-terminal')}</span>`;}
export function fileIcon(entry){
  if(entry.directory)return 'folder';
  const ext=entry.name.split('.').at(-1).toLowerCase();
  if(['js','ts','jsx','tsx','py','cs','csx','ps1','sh','c','h','cpp','hpp','go','rs','html','css'].includes(ext))return 'file-code-2';
  if(['json','yaml','yml','toml','xml','ini','conf'].includes(ext))return 'file-json';
  if(['png','jpg','jpeg','gif','webp','svg','ico'].includes(ext))return 'file-image';
  if(['zip','tar','gz','7z','rar','xz'].includes(ext))return 'file-archive';
  if(['pem','key','pub'].includes(ext))return 'key-round';
  if(['txt','md','log','csv'].includes(ext))return 'file-text';
  return 'file';
}

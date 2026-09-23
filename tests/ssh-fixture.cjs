const { Server, utils: { sftp: { OPEN_MODE, STATUS_CODE: C } } } = require('ssh2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { utils: { parseKey } } = require('ssh2');
async function fixture(root) {
  const key = crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
  const userKey=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'pkcs1',format:'pem'}}).privateKey;
  const allowedKey=parseKey(userKey);
  const clients=new Set(),forwardSockets=new Set(),commands=[],inputs=[];
  const server=new Server({hostKeys:[key]},client=>{
    client.setNoDelay(true);
    clients.add(client);client.on('error',()=>{});client.on('close',()=>clients.delete(client));
    client.on('authentication',ctx=>{
      if(ctx.username!=='tester')return ctx.reject();
      if(ctx.method==='password'&&ctx.password==='fixture-secret')return ctx.accept();
      if(ctx.method==='publickey'&&ctx.key.algo===allowedKey.type&&ctx.key.data.equals(allowedKey.getPublicSSH())&&(!ctx.signature||allowedKey.verify(ctx.blob,ctx.signature,ctx.hashAlgo)===true))return ctx.accept();
      ctx.reject();
    });
    client.on('ready',()=>{
      client.on('tcpip',(accept,reject,info)=>{
        const socket=net.connect(info.destPort,info.destIP);
        forwardSockets.add(socket);socket.on('close',()=>forwardSockets.delete(socket));
        socket.once('connect',()=>{const stream=accept();stream.pipe(socket).pipe(stream);});
        socket.once('error',()=>{reject();socket.destroy();});
      });
      client.on('session',accept=>{
      const session=accept();session.on('pty',accept=>accept());session.on('window-change',accept=>accept?.());
      session.on('exec',(accept,reject,info)=>{
        if(info.command!=='cat /proc/stat /proc/meminfo /proc/net/dev /proc/uptime')return reject();
        const stream=accept();
        stream.write('cpu  100 0 20 400 0 0 0 0 0 0\nMemTotal: 8192000 kB\nMemAvailable: 4096000 kB\neth0: 1024 0 0 0 0 0 0 0 2048 0 0 0 0 0 0 0\n12345.5 120.0\n');
        stream.exit(0);stream.end();
      });
      session.on('shell',accept=>{
        const stream=accept();let line='',password=false,screen=false;
        const prompt=()=>stream.write('fixture@host:~$ ');
        stream.write('SSH_FIXTURE_READY\r\n');prompt();
        stream.on('data',d=>{
          const data=d.toString();inputs.push(data);
          for(const c of data){
            if(c==='\x03'){line='';password=false;if(screen){stream.write('\x1b[?1049l');screen=false;}stream.write('^C\r\n');prompt();continue;}
            if(c==='\x7f'||c==='\b'){line=Array.from(line).slice(0,-1).join('');stream.write('\b \b');continue;}
            if(c==='\r'||c==='\n'){
              stream.write('\r\n');
              if(password){password=false;line='';prompt();continue;}
              commands.push(line);
              if(line==='ask-password'){password=true;line='';stream.write('Password: ');continue;}
              if(line==='screen'){screen=true;line='';stream.write('\x1b[?1049hFull-screen application');continue;}
              if(line==='burst'){for(let n=0;n<100;n++)stream.write('burst-line '.repeat(200)+'\r\n');}
              stream.write('echo:'+line+'\r\n');line='';prompt();continue;
            }
            line+=c;if(!password)stream.write(c);
          }
        });
      });
      session.on('sftp',accept=>{
        const sftp=accept(),handles=new Map();let next=1;
        const local=p=>{const candidate=path.resolve(root,'.'+path.posix.resolve('/',p));if(candidate!==root&&!candidate.startsWith(root+path.sep))throw new Error('escape');return candidate;};
        const attrs=s=>({mode:s.mode,size:s.size,uid:0,gid:0,atime:Math.floor(s.atimeMs/1000),mtime:Math.floor(s.mtimeMs/1000)});
        const handler=(name,fn)=>sftp.on(name,(id,...args)=>{try{fn(id,...args);}catch(e){sftp.status(id,e.code==='ENOENT'?C.NO_SUCH_FILE:C.FAILURE,e.message);}});
        const handle=(id,value)=>{const b=Buffer.alloc(4);b.writeUInt32BE(next);handles.set(next++,value);sftp.handle(id,b);};
        handler('REALPATH',(id,p)=>sftp.name(id,[{filename:path.posix.resolve('/',p),longname:'',attrs:{}}]));
        for(const name of ['STAT','LSTAT'])handler(name,(id,p)=>sftp.attrs(id,attrs(fs.lstatSync(local(p)))));
        handler('OPENDIR',(id,p)=>handle(id,{dir:local(p),read:false}));
        handler('READDIR',(id,h)=>{const item=handles.get(h.readUInt32BE());if(item.read)return sftp.status(id,C.EOF);item.read=true;const entries=fs.readdirSync(item.dir).map(name=>({filename:name,longname:name,attrs:attrs(fs.lstatSync(path.join(item.dir,name)))}));entries.length?sftp.name(id,entries):sftp.status(id,C.EOF);});
        handler('OPEN',(id,p,flags)=>handle(id,{fd:fs.openSync(local(p),flags&OPEN_MODE.WRITE?'w':'r')}));
        handler('FSTAT',(id,h)=>sftp.attrs(id,attrs(fs.fstatSync(handles.get(h.readUInt32BE()).fd))));
        handler('READ',(id,h,offset,length)=>{const buf=Buffer.alloc(length),n=fs.readSync(handles.get(h.readUInt32BE()).fd,buf,0,length,offset);n?sftp.data(id,buf.subarray(0,n)):sftp.status(id,C.EOF);});
        handler('WRITE',(id,h,offset,data)=>{fs.writeSync(handles.get(h.readUInt32BE()).fd,data,0,data.length,offset);sftp.status(id,C.OK);});
        handler('CLOSE',(id,h)=>{const n=h.readUInt32BE(),item=handles.get(n);if(item?.fd!==undefined)fs.closeSync(item.fd);handles.delete(n);sftp.status(id,C.OK);});
        handler('MKDIR',(id,p)=>{fs.mkdirSync(local(p));sftp.status(id,C.OK);});
        handler('RENAME',(id,a,b)=>{fs.renameSync(local(a),local(b));sftp.status(id,C.OK);});
        handler('REMOVE',(id,p)=>{fs.unlinkSync(local(p));sftp.status(id,C.OK);});
        handler('RMDIR',(id,p)=>{fs.rmdirSync(local(p));sftp.status(id,C.OK);});
        handler('SETSTAT',(id)=>sftp.status(id,C.OK));handler('FSETSTAT',(id)=>sftp.status(id,C.OK));
        sftp.on('close',()=>{for(const item of handles.values())if(item.fd!==undefined)try{fs.closeSync(item.fd);}catch{}});
      });
      });
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {port:server.address().port,userKey,commands,inputs,close:()=>{for(const socket of forwardSockets)socket.destroy();for(const c of clients)c.end();server.close();}};
}
module.exports={fixture};

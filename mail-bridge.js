// Fixed JXA program executed by osascript; input is data, never code.
function run(argv) {
  var p = JSON.parse(argv[0]);
  var app = Application('Mail');
  function account() {
    var a = app.accounts.byId(p.account_id);
    if (!a.exists()) throw Error('ACCOUNT_NOT_FOUND');
    return a;
  }
  function mailbox() {
    var box = account();
    p.mailbox_path.forEach(function (part) {
      box = box.mailboxes.byName(part);
      if (!box.exists()) throw Error('MAILBOX_NOT_FOUND');
    });
    return box;
  }
  function message() {
    var m = mailbox().messages.byId(p.message_id);
    if (!m.exists()) throw Error('MESSAGE_NOT_FOUND');
    return m;
  }
  function brief(m) {
    return {id:m.id(),subject:m.subject(),sender:m.sender(),received:m.dateReceived().toISOString(),read:m.readStatus(),size:m.messageSize()};
  }
  function attachment(a, i) {
    // Mail sometimes cannot supply MIME type (-10000); preserve other metadata.
    var mime=null;
    try { mime=a.mimeType(); } catch(e) {}
    return {index:i,id:a.id(),name:a.name(),mime_type:mime,size:a.fileSize(),downloaded:a.downloaded(),mime_type_available:mime!==null};
  }
  var data;
  if (p.action === 'accounts') {
    data = {accounts:app.accounts().map(function(a) {
      return {id:a.id(),name:a.name(),type:a.accountType(),enabled:a.enabled()};
    })};
  } else if (p.action === 'mailboxes') {
    var parent = p.mailbox_path.length ? mailbox() : account();
    var boxes = parent.mailboxes;
    var total = boxes.length;
    var stop = Math.min(total,p.offset+p.limit);
    var rows = [];
    for (var i=p.offset;i<stop;i++) {
      var b=boxes[i];
      rows.push({name:b.name(),path:p.mailbox_path.concat([b.name()]),unread:b.unreadCount(),has_children:b.mailboxes.length>0});
    }
    data={mailboxes:rows,total:total,next_offset:stop<total?stop:null};
  } else if (p.action === 'messages' || p.action === 'search') {
    var messages=mailbox().messages;
    var total=messages.length;
    var stop=Math.min(total,p.offset+p.limit);
    var rows=[];
    for(var i=p.offset;i<stop;i++) {
      var row=brief(messages[i]);
      if(p.action==='messages' || (row.subject+'\n'+row.sender).toLowerCase().indexOf(p.query.toLowerCase())>=0) rows.push(row);
    }
    data={messages:rows,total:total,scanned:Math.max(0,stop-p.offset),next_offset:stop<total?stop:null,search_scope:p.action==='search'?'subject_and_sender_in_this_page':null};
  } else if(p.action==='read') {
    var m=message();
    var before=m.readStatus();
    var body=m.content();
    var after=m.readStatus();
    data={message:brief(m),body:body.slice(0,p.max_chars),truncated:body.length>p.max_chars,read_status_before:before,read_status_after:after};
  } else if(p.action==='attachments') {
    data={attachments:message().mailAttachments().map(attachment)};
  } else if(p.action==='export') {
    var attachments=message().mailAttachments;
    if(p.attachment_index>=attachments.length) throw Error('ATTACHMENT_NOT_FOUND');
    var a=attachments[p.attachment_index];
    if(a.id()!==p.expected_attachment_id) throw Error('ATTACHMENT_CHANGED');
    if(!a.downloaded()) throw Error('ATTACHMENT_NOT_DOWNLOADED');
    if(a.fileSize()>p.max_bytes) throw Error('ATTACHMENT_TOO_LARGE');
    app.save(a,{in:Path(p.destination)});
    data={saved:true};
  } else {throw Error('UNKNOWN_ACTION');}
  return JSON.stringify(data);
}

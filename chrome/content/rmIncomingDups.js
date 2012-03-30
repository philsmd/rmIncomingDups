/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
if (typeof rmIncomingDups=="undefined") {
    var rmIncomingDups=function() {
        var prefManager=Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        var initialized=false;
        var accountSeparator=";~~~";
        var minAccount=2;
        const Cc=Components.classes;
        const Ci=Components.interfaces;
        const Cu=Components.utils;
        return {
            init:function() {
                if (!this.initialized) {
                    this.initialized=true;  
                    this.dbInit();  
                }
                if (this.translations==null) {
                    this.translations=document.getElementById("rmIncomingDupsTranslations");
                }
            },
            translations:null,
            startListener:function() {
                this.init();
                var outerthis=this;
                var newMailListener={
                    msgAdded:function(aMsgHdr) {
                        setTimeout(function() {
                            if (!aMsgHdr.isRead) {
                                outerthis.init();
                                let statusTextEl=document.getElementById('statusText');
                                statusTextEl.label=outerthis.translations.getString('rmIncomingDupsStatusText');
                                let msgAuthor=aMsgHdr.author;
                                let msgId=aMsgHdr.messageId;
                                let msgSentTime=aMsgHdr.dateInSeconds;
                                let msgSize=aMsgHdr.messageSize;
                                let msgSubject=aMsgHdr.subject;
                                let msgFolder=aMsgHdr.folder;
                                let msgServerName=msgFolder.server.prettyName;
                                if (msgFolder instanceof Ci.nsIMsgFolder&&((msgFolder.flags & Ci.nsMsgFolderFlags.Inbox)==Ci.nsMsgFolderFlags.Inbox)) {
                                    let prefManager=Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
                                    let compareAuthor=prefManager.getBoolPref("extensions.rmIncomingDups.compareAuthor");
                                    let compareMessageId=prefManager.getBoolPref("extensions.rmIncomingDups.compareMessageId");
                                    let compareLines=prefManager.getBoolPref("extensions.rmIncomingDups.compareLines");
                                    let compareSendTime=prefManager.getBoolPref("extensions.rmIncomingDups.compareSendTime");
                                    let compareTime=prefManager.getCharPref("extensions.rmIncomingDups.compareTime");
                                    let compareSize=prefManager.getBoolPref("extensions.rmIncomingDups.compareSize");
                                    let compareSubject=prefManager.getBoolPref("extensions.rmIncomingDups.compareSubject");
                                    let compareBody=prefManager.getBoolPref("extensions.rmIncomingDups.compareBody");
                                    let action=prefManager.getCharPref("extensions.rmIncomingDups.action");     // String
                                    let stmt=outerthis.dbConnection.createStatement("SELECT name,account FROM rules r join rulesAccount a on r.id=a.rule WHERE :searchAccount IN (SELECT account FROM rules r2 join rulesAccount a2 on r2.id=a2.rule WHERE r2.id=r.id) AND account<> :searchAccount2");
                                    stmt.params.searchAccount=msgServerName;
                                    stmt.params.searchAccount2=msgServerName; // idem
                                    stmt.executeAsync({
                                        handleResult:function(aResultSet) {
                                            Cu.import("resource:///modules/mailServices.js");   // MailServices
                                            Cu.import("resource:///modules/iteratorUtils.jsm"); // for fixIterator
                                            let accountName,ruleName;
                                            let shouldExit=false;
                                            for (let row=aResultSet.getNextRow();row;row=aResultSet.getNextRow()) {
                                                ruleName=row.getResultByName("name");
                                                accountName=row.getResultByName("account");
                                                for each (let account in fixIterator(MailServices.accounts.accounts,Ci.nsIMsgAccount)) {
                                                    let server=account.incomingServer;
                                                    if (server&&server.prettyName==accountName) {
                                                        let root=server.rootFolder;
                                                        if (root.hasSubFolders) {
                                                            for each (let folder in fixIterator(root.subFolders,Ci.nsIMsgFolder)) {
                                                                let msgArray=folder.messages;
                                                                let performAction; 
                                                                let msgUri=aMsgHdr.folder.getUriForMsg(aMsgHdr);
                                                                let msgLineCount=aMsgHdr.lineCount;
                                                                let msgLineCountTrialsMax=300000;
                                                                let msgLineCountTrials=0;
                                                                while (msgLineCount==0&&msgLineCountTrials<msgLineCountTrialsMax) {
                                                                    msgLineCount=aMsgHdr.lineCount;             
                                                                    msgLineCountTrials++;
                                                                }
                                                                while (msgArray.hasMoreElements()) {
                                                                    let subfolderMsgHdr=msgArray.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
                                                                    let performAction=true;
                                                                    if (compareAuthor&&msgAuthor!=subfolderMsgHdr.author) {
                                                                        performAction=false;
                                                                    }
                                                                    if (performAction&&compareSubject&&msgSubject!=subfolderMsgHdr.subject) {
                                                                        performAction=false;
                                                                    }
                                                                    if (performAction&&compareMessageId&&msgId!=subfolderMsgHdr.messageId) {
                                                                        performAction=false;
                                                                    }
                                                                    if (performAction&&compareLines&&Math.abs(msgLineCount-subfolderMsgHdr.lineCount)<4) {
                                                                        performAction=false;
                                                                    }
                                                                    if (performAction&&compareSendTime) {
                                                                        let maxDiff=0;
                                                                        if (compareTime=="seconds") {
                                                                            maxDiff=45;
                                                                        } else if (compareTime=="minutes") {
                                                                            maxDiff=180;
                                                                        } else if (compareTime=="day") {
                                                                            maxDiff=86400;
                                                                        } else if (compareTime=="3 day") {
                                                                            maxDiff=246400;
                                                                        } else {  // hours
                                                                            maxDiff=9000;   // 2.5 hours
                                                                        }
                                                                        let tmpTime=subfolderMsgHdr.dateInSeconds;
                                                                        performAction=(msgSentTime-tmpTime)<maxDiff;
                                                                    }
                                                                    if (performAction&&compareSize&&msgSize!=subfolderMsgHdr.messageSize) {
                                                                        performAction=false;
                                                                    }
                                                                    if (performAction&&compareBody) {
                                                                        let oldMessageUri=subfolderMsgHdr.folder.getUriForMsg(subfolderMsgHdr);
                                                                        if ((outerthis.getMsgBody(msgUri))!=(outerthis.getMsgBody(oldMessageUri))) {
                                                                            performAction=false;
                                                                        }
                                                                    }
                                                                    if (performAction) {
                                                                        let msgHdrArray=Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
                                                                        msgHdrArray.appendElement(aMsgHdr,false);
                                                                        if (action=="mark_read") {
                                                                            aMsgHdr.markRead(true);
                                                                        } else if (action=="move") {
                                                                            aMsgHdr.folder.deleteMessages(msgHdrArray,msgWindow,false,true,null,true);
                                                                            aMsgHdr.folder.msgDatabase=null;
                                                                        } else if (action=="delete") {
                                                                            aMsgHdr.markRead(true);
                                                                            aMsgHdr.folder.deleteMessages(msgHdrArray,msgWindow,false,false,null,true);
                                                                            aMsgHdr.folder.msgDatabase=null;
                                                                        } else if (action=="delete_permanently"){
                                                                            aMsgHdr.folder.deleteMessages(msgHdrArray,msgWindow,true,false,null,false);
                                                                            aMsgHdr.folder.msgDatabase=null;
                                                                        }
                                                                        shouldExit=true;
                                                                    }
                                                                } 
                                                                if (shouldExit) {
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        break;
                                                    }
                                                    if (shouldExit) {
                                                        break;
                                                    }
                                                }
                                                if (shouldExit) {
                                                    break;
                                                }
                                            }
                                        },
                                        handleError:function(aError) {},
                                        handleCompletion:function(aReason) {}
                                    });
                                }
                                setTimeout(function() {statusTextEl.label="";},900);
                            }
                        },800);
                    }
                }
                var nS=Cc["@mozilla.org/messenger/msgnotificationservice;1"].getService(Ci.nsIMsgFolderNotificationService);
                nS.addListener(newMailListener,nS.msgAdded);
            },
            getMsgBody:function(messageURI) {
                let msgService=messenger.messageServiceFromURI(messageURI);
                let msgStream=Cc["@mozilla.org/network/sync-stream-listener;1"].createInstance();
                let scriptInput=Cc["@mozilla.org/scriptableinputstream;1"].createInstance();
                let scriptInputStream=scriptInput.QueryInterface(Ci.nsIScriptableInputStream);
                scriptInputStream.init(msgStream);
                try {
                    msgService.streamMessage(messageURI,msgStream,msgWindow,null,false,null);  // msgWindow is global
                } catch (ex) {
                    return;
                }
                // start reading
                let content="";
                while (scriptInputStream.available()) {
                    content+=scriptInputStream.read(512);
                }
                // strip header and check if container/fragment type
                let pos=content.indexOf((/^Content-Type: /im).exec(content));
                let body=content.substring(pos);
                let contentType=(/^Content-Type: (.+)$/im).exec(body)[1];
                let mpRegEx=/^multipart\/(.+);/i;
                if (mpRegEx.test(contentType)) {
                    content=this.emailContainer(body);
                } else {
                    content=this.emailFragment(body);
                }
                if (typeof content!="undefined"&&content!=null) {
                    content=content.replace(/^\s\s*/,'').replace(/\s\s*$/,''); // trim it
                }
                return content;
            },
            emailContainer:function(content) {
                let typeFirst=(/^Content-Type: ((.|(\n ))+)\n\n/im).exec(content);
                if (typeof typeFirst=="undefined"||typeFirst==null) {
                    typeFirst=(/^Content-Type: ((.|(\n ))+)\r\n/im).exec(content);
                }
                let contents=new Array();
                if (typeof typeFirst!="undefined"&&typeFirst!=null) {
                    let type=typeFirst[1];
                    let boundary=(/^ boundary="(.+)"/m).exec(type)[1];
                    let contentRegEx=new RegExp("--"+boundary+"\n(((.|\\s)+)--"+boundary+")--","img");
                    let containerContentsFirst=contentRegEx.exec(content);
                    if (typeof containerContentsFirst=="undefined"||containerContentsFirst==null) {
                        contentRegEx=new RegExp("--"+boundary+"\r?\n(((.|\\s)+)--"+boundary+")--","img");
                        containerContentsFirst=contentRegEx.exec(content);
                    }
                    if (typeof containerContentsFirst!="undefined"&&containerContentsFirst!=null) {
                        let containerContents=containerContentsFirst[1];
                        let boundaryRegEx=new RegExp("^([\\s\\S]+?)--"+boundary,"m");
                        while (boundaryRegEx.test(containerContents)) {
                            var nextPart=boundaryRegEx.exec(containerContents)[1];
                            containerContents=containerContents.substring(nextPart.length+boundary.length+4);
                            if ((/^Content-Type: multipart\/(.+);/i).test(nextPart)) {
                                contents.push(this.emailContainer(nextPart));
                            } else {
                                contents.push(this.emailFragment(nextPart));
                            }
                        }
                    }
                }
                return contents;
            },
            emailFragment:function(content) {
                let res=(/^.*\n\n([\s\S]+)\n\n/m).exec(content);
                if (typeof res=="undefined"||res==null) {
                    res=(/^.*\r\n([\s\S]+)\r\n/m).exec(content);
                }
                return res[1];
            },
            dbConnection:null,  
            dbSchema: {  
                tables: {  
                    rules:"id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,description TEXT",
                    rulesAccount:"rule INTEGER NOT NULL,account TEXT NOT NULL,UNIQUE (rule,account)"
                }  
            },  
            dbInit:function() {
                var dirService=Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
                var dbFile=dirService.get("ProfD",Ci.nsIFile);
                dbFile.append("rmIncomingDups.sqlite");
                var dbService=Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
                var dbConnection;
                if (!dbFile.exists()) {
                    dbConnection=this.dbCreate(dbService,dbFile);
                } else {
                    dbConnection=dbService.openDatabase(dbFile);
                }
                this.dbConnection=dbConnection;
            },
            dbCreate:function(aDBService,aDBFile) {
                var dbConnection=aDBService.openDatabase(aDBFile);
                this.dbCreateTables(dbConnection);
                return dbConnection;  
            },
            dbCreateTables:function(aDBConnection) {
                for (var name in this.dbSchema.tables) {
                    aDBConnection.createTable(name,this.dbSchema.tables[name]);
                }
                for (var name in this.dbSchema.tables) {
                    aDBConnection.createTable(name,this.dbSchema.tables[name]);
                }
            },
            getAccountList:function() {
                Cu.import("resource:///modules/mailServices.js");   // MailServices
                Cu.import("resource:///modules/iteratorUtils.jsm"); // for fixIterator
                let data=[];
                for each (let account in fixIterator(MailServices.accounts.accounts,Ci.nsIMsgAccount)) {
                    let server=account.incomingServer;
                    if (server) {
                        data.push(server.prettyName);
                    }
                }
                return data;
            },
            setRuleList:function() {
                this.init();
                let listboxEl=document.getElementById('rulesListBox');
                // clear the list if needed
                let childNodes=listboxEl.childNodes;
                for (let i=0;i<childNodes.length;i++) {
                    if (childNodes[i].tagName=="listitem") {
                        listboxEl.removeChild(listboxEl.childNodes[i]);
                        i--;
                    }
                }
                let statement=this.dbConnection.createStatement("SELECT name,description,GROUP_CONCAT(account,';') AS accounts FROM rules r join rulesAccount a on r.id=a.rule group by r.id");
                let outerthis=this;
                statement.executeAsync({
                    handleResult:function(aResultSet) {
                        let newListCell,newListRow;
                        for (let row=aResultSet.getNextRow();row;row=aResultSet.getNextRow()) {
                            newListRow=document.createElement('listitem');
                            // name
                            newListCell=document.createElement('listcell');
                            newListCell.setAttribute('label',row.getResultByName("name"));
                            newListRow.appendChild(newListCell);
                            // description
                            newListCell=document.createElement('listcell');
                            newListCell.setAttribute('label',row.getResultByName("description"));
                            newListRow.appendChild(newListCell);
                            // accounts
                            newListCell=document.createElement('listcell');
                            newListCell.setAttribute('label',row.getResultByName("accounts"));
                            newListRow.appendChild(newListCell);

                            listboxEl.appendChild(newListRow);
                        }
                    },
                    handleError:function(aError) {
                        alert(outerthis.translations.getString('rmIncomingDupsStandardHandleError')+" "+aError.message);
                    },
                    handleCompletion:function(aReason) {
                        if (aReason!=Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
                            alert(outerthis.translations.getString('rmIncomingDupsHandleCompletionCanceled'));
                        }
                    }
                });
            },
            rmRule:function() {
                this.init();
                var listboxEl=document.getElementById('rulesListBox');
                if (typeof listboxEl!="undefined"&&listboxEl!=null&&listboxEl.selectedIndex>=0) {
                    var currItem=listboxEl.selectedItem;
                    if (typeof currItem!="undefined"&&currItem!=null) {
                        var itemName=(currItem.childNodes[0]).getAttribute('label');
                        if (typeof itemName!="undefined"&&itemName!=null&&itemName.length>0) {
                            var statement=this.dbConnection.createStatement("SELECT id FROM rules WHERE name=:ruleName");
                            statement.params.ruleName=itemName;
                            let dbConnection=this.dbConnection;
                            let outerthis=this;
                            statement.executeAsync({
                                handleResult:function(aResultSet) {
                                    if (row=aResultSet.getNextRow()) {
                                        var ruleId=row.getResultByName("id");
                                        if (ruleId!=null&&typeof ruleId=="number"&&ruleId>0) {
                                            dbConnection.executeSimpleSQL("DELETE FROM rulesAccount WHERE rule="+ruleId);
                                            dbConnection.executeSimpleSQL("DELETE FROM rules WHERE id="+ruleId);
                                            outerthis.setRuleList();
                                        }
                                    }
                                },
                                handleError:function(aError) {
                                    alert(outerthis.translations.getString('rmIncomingDupsStandardHandleError')+" "+aError.message);
                                },
                                handleCompletion:function(aReason) {
                                    if (aReason!=Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
                                        alert(outerthis.translations.getString('rmIncomingDupsHandleCompletionCanceled'));
                                    }
                                }
                            });
                        }
                    }
                }
            },
            addRule:function() {
                this.init();
                window.openDialog("chrome://rmIncomingDups/content/ruleDialog.xul",this.translations.getString('rmIncomingDupsDialogNewRule'),"modal");
                this.setRuleList();
            },
            modifyRule:function() {
                this.init();
                var listboxEl=document.getElementById('rulesListBox');
                if (typeof listboxEl!="undefined"&&listboxEl!=null&&listboxEl.selectedIndex>=0) {
                    var currItem=listboxEl.selectedItem;
                    if (typeof currItem!="undefined"&&currItem!=null) {
                        var itemName=(currItem.childNodes[0]).getAttribute('label');
                        if (typeof itemName!="undefined"&&itemName!=null&&itemName.length>0) {
                            var statement=this.dbConnection.createStatement("SELECT description,GROUP_CONCAT(account,'"+accountSeparator+"') AS accounts FROM rules r join rulesAccount a on r.id=a.rule WHERE name=:ruleName group by r.id");
                            statement.params.ruleName=itemName;
                            let dbConnection=this.dbConnection;
                            let outerthis=this;
                            statement.executeAsync({
                                handleResult:function(aResultSet) {
                                    if (row=aResultSet.getNextRow()) {
                                        var ruleAccounts=row.getResultByName("accounts");
                                        if (typeof ruleAccounts!="undefined"&&ruleAccounts!=null) {
                                            window.openDialog("chrome://rmIncomingDups/content/ruleDialog.xul",outerthis.translations.getString('rmIncomingDupsDialogNewRule'),"modal",itemName,
                                              row.getResultByName("description"),ruleAccounts);
                                            outerthis.setRuleList();
                                        }
                                    }
                                },
                                handleError:function(aError) {
                                    alert(outerthis.translations.getString('rmIncomingDupsStandardHandleError')+" "+aError.message);
                                },
                                handleCompletion:function(aReason) {
                                    if (aReason!=Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
                                        alert(outerthis.translations.getString('rmIncomingDupsHandleCompletionCanceled'));
                                    }
                                }
                            });
                        }
                    }
                } else {
                    alert(this.translations.getString('rmIncomingDupsSelectItem'));
                }
            },
            onUpdRuleDialog:function(win) {
                this.init();
                let caption=document.getElementById("ruleDialogTitle");
                // set the list of accounts
                let  listAccounts=this.getAccountList();                
                let listAccountEl=document.getElementById('allAccountNamesListCheckBox');
                let tmpListItem;
                for (let i=0;i<listAccounts.length;i++) {
                    tmpListItem=document.createElement('listitem'); 
                    tmpListItem.setAttribute('type','checkbox');
                    tmpListItem.setAttribute('label',listAccounts[i]);
                    listAccountEl.appendChild(tmpListItem);
                }
                // update title,insert text and select accounts
                if (typeof window.arguments!="undefined"&&window.arguments!=null&&window.arguments.length>0) {
                    win.document.title=this.translations.getString('rmIncomingDupsDialogModifyRule');
                    caption.label=this.translations.getString('rmIncomingDupsDialogModifyRule')+":";
                    let elementRuleDescription=document.getElementById('rmIncomingDups-description');
                    elementRuleDescription.value=window.arguments[1];
                    let accountParam=window.arguments[2];
                    let accountParamSplit=accountParam.split(accountSeparator);
                    let childNodes=listAccountEl.childNodes;
                    let childNodesNum=childNodes.length
                    for (let i=0;i<accountParamSplit.length;i++) {
                        for (let j=0;j<childNodesNum;j++) {
                            if (childNodes[j].tagName=="listitem"&&childNodes[j].label==accountParamSplit[i]) {
                                childNodes[j].setAttribute('checked','checked');
                                childNodes[j].checked=true;
                            }
                        }
                    }
                    let elementRuleName=document.getElementById('rmIncomingDups-rulename');
                    elementRuleName.value=window.arguments[0];
                    elementRuleName.title=window.arguments[0]; // the "OLD" name
                } else {
                    win.document.title=this.translations.getString('rmIncomingDupsDialogNewRule');
                    caption.label=this.translations.getString('rmIncomingDupsDialogAddNewRule'); 
                }
            },
            saveNewRule:function() {
                this.init();
                let ret=false;
                let dialogTitle=document.getElementById('ruleDialogTitle').label;
                let ruleName=document.getElementById('rmIncomingDups-rulename').value;
                if (typeof ruleName=="undefined"||ruleName==null||ruleName.length<1) {
                    alert(this.translations.getString('rmIncomingDupsSpecifyRule'));
                    return ret;
                }
                let ruleOldName=document.getElementById('rmIncomingDups-rulename').title;
                // get all selected accounts (if none selected=>error)
                let listAccountEl=document.getElementById('allAccountNamesListCheckBox');
                let childNodes=listAccountEl.childNodes;
                let childNodesNum=childNodes.length
                let selectedAccounts=[];
                for (let i=0;i<childNodesNum;i++) {
                    if (childNodes[i].tagName=="listitem"&&(childNodes[i].checked==true||
                      childNodes[i].getAttribute('checked')=='checked')) {
                        selectedAccounts.push(childNodes[i].label);
                    }
                }
                if (selectedAccounts.length<minAccount) {
                    alert((this.translations.getString('rmIncomingDupsSelectMinAccounts')).replace('XXX',minAccount));
                    return ret;
                }
                let ruleDesc=document.getElementById('rmIncomingDups-description').value;
                if (dialogTitle==this.translations.getString('rmIncomingDupsDialogAddNewRule')) {
                    let stmt=this.dbConnection.createStatement("INSERT INTO rules (name,description) VALUES (:ruleName,:ruleDesc)");
                    stmt.params.ruleName=ruleName;
                    stmt.params.ruleDesc=ruleDesc;
                    try {
                        stmt.executeStep();
                        let newId=this.dbConnection.lastInsertRowID;
                        if (typeof newId=="undefined"||newId==null||newId<1) {
                            ret=false;
                        } else {
                            for (let i=0;i<selectedAccounts.length;i++) {
                                stmt=this.dbConnection.createStatement("INSERT INTO rulesAccount (rule,account) VALUES (:ruleId,:accountName)");
                                stmt.params.ruleId=newId;
                                stmt.params.accountName=selectedAccounts[i];
                                stmt.executeStep();
                            }
                            ret=true;
                        }
                    } catch (err) {
                        if (String(err).indexOf('NS_ERROR_STORAGE_CONSTRAINT')!=-1) {
                            alert(this.translations.getString('rmIncomingDupsRuleNamePresent'));
                        } else {
                            alert(this.translations.getString('rmIncomingDupsErrorInserting'));
                        }
                        ret=false;
                    } finally {
                        stmt.reset();
                    }
                } else {
                    var stmt=this.dbConnection.createStatement("SELECT id FROM rules WHERE name=:ruleName");
                    stmt.params.ruleName=ruleOldName;
                    try {
                        if (stmt.executeStep()) {
                            let theId=stmt.row.id;
                            if (typeof theId=="number"&&theId>0) {
                                this.dbConnection.executeSimpleSQL("DELETE FROM rulesAccount WHERE rule="+theId);
                                stmt=this.dbConnection.createStatement("UPDATE rules SET name=:ruleName,description=:ruleDesc WHERE id=:ruleId");
                                stmt.params.ruleName=ruleName;
                                stmt.params.ruleDesc=ruleDesc;
                                stmt.params.ruleId=theId;
                                stmt.executeStep();
                                for (let i=0;i<selectedAccounts.length;i++) {
                                    stmt=this.dbConnection.createStatement("INSERT INTO rulesAccount (rule,account) VALUES (:ruleId,:accountName)");
                                    stmt.params.ruleId=theId;
                                    stmt.params.accountName=selectedAccounts[i];
                                    stmt.executeStep();
                                }
                                ret=true;
                            }
                        }
                    } catch (err) {
                        if (String(err).indexOf('NS_ERROR_STORAGE_CONSTRAINT')!=-1) {
                            alert(this.translations.getString('rmIncomingDupsRuleNamePresent'));
                        } else {
                            alert(this.translations.getString('rmIncomingDupsErrorUpdating'));
                        }
                        ret=false;
                    } finally {
                        stmt.reset();
                    }
                }
                return ret;
            },
            openOptionDialog:function() {
                this.init();
                window.openDialog("chrome://rmIncomingDups/content/options.xul","Options","modal");
            }
        };
    }();
    window.addEventListener("load",rmIncomingDups.init,false);
}

function setup() {
}

function gup( name, url ) { // https://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
    if (!url) url = location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    return results == null ? null : results[1];
}

function msg(obj){
  var name = gup('name');  
  client_args = {identifier: name, seedRpcServerAddr: 'http://node00002.nkn.org:30003'};
  savedKeys = localStorage.getItem('savedKeys '+name);
  if (savedKeys != null) {
      console.log('found savedKeys info of', savedKeys);
      try {
	  savedKeys = JSON.parse(savedKeys);
	  console.log('found savedKeys for', name);
      } catch {
	  console.log('found savedKeys that failed to parse for', name);
	  savedKeys = {};
      }
  } else {
      console.log('no savedKeys seen for', name);
      savedKeys = {};
  }
  if ('privateKey' in savedKeys) {
      console.log('using the saved private key for', name);
      client_args['privateKey'] = savedKeys['privateKey'];
  }

  var client = nkn(client_args);

  if ('clientAddr' in savedKeys) {
      if (client.addr != savedKeys['clientAddr']) {
	  console.log('Surprised that the client addr changed for', name);
      }
  }
  savedKeys = {privateKey: client.key.privateKey, clientAddr: client.addr};
  localStorage.setItem('savedKeys '+name, JSON.stringify(savedKeys));

  history_key = 'history '+client.identifier;

  // now that I have my address, show it
  var newaddritem = document.createElement("div");
  newaddritem.innerText = client.addr;
  var myAddress = document.getElementById("myAddress");
  myAddress.appendChild(newaddritem);

  var conn;
  var msg = document.getElementById("msg");
  var sendTo = document.getElementById("sendTo");
  var log = document.getElementById("log");
  var img = document.getElementById("fileupload");
  var form = document.getElementById("form");
  var user_aliases = {}
  var alias_users = {}

  img.addEventListener('change', encodeImageFileAsURL);
  form.addEventListener('submit', submitForm);
  if (localStorage.getItem(history_key) === null) {
    localStorage.setItem(history_key, JSON.stringify([]))
  } else {
    // initilize log from localstorage
    try {
        var historyArr = JSON.parse(localStorage.getItem(history_key));
	console.log('Found history in localStorage');
    } catch(e) {
	console.log('Got an exception parsing the saved history, discarding it for', name);
	localStorage.setItem(history_key, JSON.stringify([]));
        historyArr = [];
    }

    var historyArrRev = historyArr.slice(0).reverse();
    for (i = 0; i < historyArrRev.length; i++) {
	entry = historyArrRev[i];
	console.log('entry is', entry);
	if (entry.includes(' will be known as ')) {
	    // might be, be a little careful
	    parts = entry.split(' will be known as ', 2);
	    src = parts[0];
	    alias = parts[1];
	    console.log('considering making an alias for', alias);
	    if (src.length < 60) {
		console.log('skippig making an alias for length', alias, src);
		continue;
	    }
	    if (!(src in user_aliases) && !(alias in alias_users)) {
		console.log('making an alias', alias, src);
		user_aliases[src] = alias;
		alias_users[alias] = src;
	    }
	}
    }

    if (historyArr.length > 100) {
	cosole.log('Long history trimmed to 100');
	l = historyArr.length;
        historyArr = historyArr.slice(l - 100, l);
	localStorage.setItem(history_key, JSON.stringify(historyArr));
    }

    for (var i = 0; i < historyArr.length; i++) {
      var item = document.createElement("div");
      item.innerText = historyArr[i];
      appendLog(item);
    }
  }

  function history_append(message) {
      historyArr = JSON.parse(localStorage.getItem(history_key));
      historyArr.push(message);
      localStorage.setItem(history_key, JSON.stringify(historyArr));
  }

  function alias_to_user(a) {
      return (a in alias_users ? alias_users[a] : a);
  }

  function submitForm(e) {
      e.preventDefault();
      if (!msg.value) {
        return false;
      }
      if (!sendTo.value) {
        return false;
      }
      client.send(
        alias_to_user(sendTo.value),
        JSON.stringify({type: "txt", data: msg.value}),
      );
      var item = document.createElement("div");
      item.innerText = "You: " + msg.value;
      appendLog(item);
      history_append("You: " + msg.value);

      msg.value = "";
      return false;
  }

  function encodeImageFileAsURL() {
    file = this.files[0];
    if (file){
      var reader = new FileReader();
      var type = file.type;
      reader.onloadend = function() {
        console.log('RESULT', reader.result);
        client.send(
          alias_to_user(sendTo.value),
          JSON.stringify({type: type, data: reader.result})
        );
      }
      reader.readAsDataURL(file);
    }
  }

  function appendLog(item) {
    var doScroll = log.scrollTop > log.scrollHeight - log.clientHeight - 1;
    log.appendChild(item);
    if (doScroll) {
      log.scrollTop = log.scrollHeight - log.clientHeight;
    }
  }

  function gotGiphyData(name){
     function gotGiphy(giphy){
      console.log(giphy.data.image_url);
      let item = document.createElement("div");
      let div = document.createElement("div");
      div.innerText = name;
      item.appendChild(div);
      let image = new Image();
      item.appendChild(image);
      image.src = giphy.data.image_url;
      document.getElementById("log").appendChild(item);
    }
    return gotGiphy;
  }

  //websocket
    if (window["WebSocket"]) {

      client.on('connect', () => {
        console.log('Connection opened.');
      });

      client.on('message', (src, payload) => {
    	  console.log(src);
    	  console.log(payload);
        var data = JSON.parse(payload);
        if (data.type && data.type.indexOf("/") >= 0){
          var type = data.type.split("/")[0];
        } else {
          var type = "txt";
        }
        if (type === "image"){
          var item = document.createElement("div");
          var image = new Image();
          item.appendChild(image);
          document.getElementById("log").appendChild(item);
          image.src = data.data;
        }
        if (type === "video"){
          var item = document.createElement("div");
          item.innerHTML = "<video class=\"video-js\" controls ></video>"
          document.getElementById("log").appendChild(item);
          item.firstChild.src = data.data;
        }
        if (type === "txt"){
          if (data.data.startsWith("/giphy ")){
            var query = data.data.substr(7).trim().split(/\s+/).join("+");
            loadJSON(`http://api.giphy.com/v1/gifs/random?q=${query}&api_key=dc6zaTOxFJmzC`, gotGiphyData(data.data))
          } else if (data.data.startsWith("/retry")){
            if (file){
              var reader = new FileReader();
              var type = file.type;
              reader.onloadend = function() {
                console.log('RESULT', reader.result);
                client.send(
		  alias_to_user(sendTo.value),
                  JSON.stringify({type: type, data: reader.result})
                );
              }
              reader.readAsDataURL(file);
            }
          } else {
            var messages = data.data.split('\n');

	    if (src in user_aliases) {
		alias = user_aliases[src];
            } else {
		alias = src.split('.', 2)[0];
		if (alias in alias_users) {
		    // generate a unique alias
		    for (var alias_suffix = 1; alias_suffix < 100000; alias_suffix++) {
			attempt = alias + alias_suffix.toString();
			if (!(attempt in alias_users)) {
			    alias = attempt;
			    break;
			}
		    }
		    if (alias in alias_users) {
			throw "failed to make a unique alias";
		    }
		}
		alias_users[alias] = src;
		user_aliases[src] = alias
		var item = document.createElement("div");
		fulltext = src+" will be known as "+alias;
		item.innerText = fulltext
		history_append(fulltext);
		appendLog(item);
		if (!sendTo.value || sendTo.value == src) {
		    sendTo.value = alias
		}
	    }

            for (var i = 0; i < messages.length; i++) {
        	var item = document.createElement("div");
		fulltext = alias + ": " + messages[i];
        	item.innerText = fulltext
        	appendLog(item);
		history_append(fulltext);
            }
          }
        }
      });
    } else {
      var item = document.createElement("div");
      item.innerHTML = "<b>Your browser does not support WebSockets.</b>";
      appendLog(item);
    }

}

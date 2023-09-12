chrome.runtime.onInstalled.addListener(function() {
  chrome.tabs.create({
    url: 'https://app.ilazy.net/',
    active: true
  });

  chrome.storage.sync.set({ "isNewUser": true }, function(){});
  return false;
});

chrome.runtime.setUninstallURL('https://ilazy.net/uninstallext/');


var backend_url = 'https://app.ilazy.net/';

const onAllowedSite = (tabId, source_name) => {
  chrome.storage.sync.set({ "productTab": tabId }, function(){});
  chrome.storage.sync.set({ "source_name": source_name }, function(){});

  chrome.storage.sync.get(['access_token', "refresh_token", "new_user"], function(items){
    chrome.tabs.sendMessage(tabId, {
      type: "NEW_PRODUCT_LOADED",
      source_name: source_name,
      refresh_token : items.refresh_token,
      access_token: items.access_token,
      new_user: items.new_user
    });
  });
}

chrome.tabs.onUpdated.addListener( function (tabId, changeInfo, tab) {
  if (changeInfo.status == 'complete') {
    
    if (tab.url && tab.url.includes("amazon.com/")) {
      onAllowedSite(tabId, "amazon.com");
    }

    // after login
    if (tab.url && tab.url.includes(`${backend_url}auth/complete/extension`)) {
      chrome.cookies.get({ url: `${backend_url}auth/complete/extension`, name: 'access' },
        function (cookie) {
          if (cookie) {
            // set access token
            chrome.storage.sync.set({ "access_token": cookie.value }, function(){
              chrome.cookies.get({ url: `${backend_url}auth/complete/extension`, name: 'refresh' },
                function (cookie) {
                  // set access token
                  chrome.storage.sync.set({ "refresh_token": cookie.value }, function(){
                      chrome.storage.sync.get(['productTab'], function(items){
                        // login initailized from page not popup
                        let productTab = items.productTab;
                        if (productTab) {
                          chrome.storage.sync.get(['access_token', "refresh_token"], function(items){

                            chrome.tabs.sendMessage(productTab, {
                              type: "USER_LOGGED_IN",
                              refresh_token : items.refresh_token,
                              access_token: items.access_token
                            });
                          });
                          chrome.tabs.update(parseInt(productTab), {highlighted: true});
                        }

                        chrome.storage.sync.remove(['productTab'],function() {});
                        return;
                      }
                    );
                  });
                }
              );
            });
          }
        }
      );


      // close tab and return
      chrome.tabs.remove(tab.id, function() {});
    }

  }
})

const openLoginWindow = () => {
  chrome.tabs.create({
    url: `${backend_url}auth/login/extension/`,
    selected: true,
  })
}


function messageListener(request, sender, sendResponse) {

  if (request.type == 'LOGIN') {
    openLoginWindow()
  }

  if (request.type == 'DOWNLOAD') {
    if (request.pricing === "Master") {
      chrome.storage.sync.get(["source_name"], function(items){
        let folder = 'Ilazy-media';
        let subFolder = `${items.source_name}/${request.productName.trim()}`;
        let itemName = `${new Date().getSeconds()}.${request.mediaType}`
  
        let filename = `${folder}/${subFolder}/${request.subfolder}/${itemName}`;
        chrome.downloads.download({filename: filename, url: request.url});

      })

    }
    else {
      chrome.downloads.download({
        url: request.url
      });
    }
  }
  if (request.type == 'AD_REDIRECT') {
    chrome.tabs.create({
      url: `https://app.ilazy.net/redirect?source_name=${request.source}`,
      selected: true,
    })
  }
  if (request.type == "log_out_user") {
    chrome.storage.sync.remove(["access_token","refresh_token"],function() {})
  }

  sendResponse();
}

chrome.runtime.onMessage.addListener(messageListener);

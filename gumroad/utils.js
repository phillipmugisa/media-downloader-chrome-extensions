// Get the current tab

export async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  // `tab` will either be a `tabs.Tab` instance or `undefined`.
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

export class AppVariables {
  constructor () {
      this.isLoggedIn = null;
      this.userSubscriptionFeatures = null;
      this.source_name = null;
      this.activeTabId = null;
      this.allowedSite = false;
  }
  
  setAuthStatus = (status) => {
      this.isLoggedIn = status;
  }

  getAuthStatus = () => this.isLoggedIn;

  setUserFeatures = (features) => {
      this.userSubscriptionFeatures = features;
  }

  getUserFeatures = () => this.userSubscriptionFeatures;

  setSourceName = (name) => {
      this.source_name = name;
  }

  getSourceName = () => this.source_name;

  setIsAllowedSite = (state) => {
      this.allowedSite = state;
  }

  getIsAllowedSite = () => this.allowedSite;

  setActiveTabId = (value) => {
      this.activeTabId = value;
  }

  getActiveTabId = () => this.activeTabId;

  getAll = () => {
    return {
      features: this.userSubscriptionFeatures,
      authStatus: this.authStatus
    }
  }
}


  // make requests
  export const makeRequest = async (url, method, data) => {

    var backend_url = 'https://app.ilazy.net/';
    let fetchData = {
        method: method,
        mode: "cors",
        cache: "no-cache",
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
    };

    if (method == "POST") {
        fetchData["headers"] = {
            'Content-Type' : 'application/json'
        }
        fetchData["body"] = JSON.stringify(data);
    }
    else {
        fetchData["headers"] = {
            'Content-Type' : 'application/json',
            Authorization: data['access'] ? "JWT " + data['access'] : null,
        };
    }

    const response = await fetch(`${backend_url}${url}`, fetchData)
    if (response.status >= 200 && response.status <= 299) {
        return await response.json();
    }
    else {
        return false;
    }
}
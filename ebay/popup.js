import { getCurrentTab, AppVariables, makeRequest } from './utils.js';

let backend_url = 'https://app.ilazy.net/';
let app = new AppVariables()
const extContainerAuth = document.querySelector(".ext-container#auth")
const extContainerDetails = document.querySelector(".ext-container#details")

let userFeatures = null;

const checkAuth = async (access_token, refresh_token) => {
    // attempt login using access key
    let response = await makeRequest("api/subscriptions/aliexpress/", "GET", {"access": access_token});
    if (response) {
        // if successful, render download features     
        return response;
    }
    else {
        // else refresh token
        response = await makeRequest("api/token/refresh/", "POST", {"refresh": refresh_token});
        if (response) {
            // reset access token
            // send message to background to update existing tokens
            chrome.storage.sync.set({ "access_token": response.access}, function(){});
            chrome.storage.sync.set({ "refresh_token": refresh_token}, function(){});
                        
            // rerun check to fetch features;
            checkAuth(response.access, response.refresh);
        }
        else {
            app.setAuthStatus(false);
            app.setUserFeatures(null);
            userFeatures = null;
            return false;
        }
    }
}

const renderDetailsViews = () => {
    extContainerAuth.style.display = "none";
    extContainerDetails.style.display = "block";

    let _data = app.getUserFeatures() ? app.getUserFeatures() : userFeatures;

    document.querySelector("#popup-intro").textContent = `Hello, ${_data['user']['username']}`
    document.querySelector("#package-area").textContent = `${_data['pricing']} Package`

    // login user out
    document.querySelector("#popup-logout").addEventListener("click", () => {
        chrome.storage.sync.remove(["access_token","refresh_token"],function() {})
        try {
            if (app.getIsAllowedSite() && app.getActiveTabId()) {
                chrome.tabs.sendMessage(app.getActiveTabId(), {type: "LOGOUT"});
                chrome.storage.sync.set({ "manualLogout": true}, function(){});
            }
            app.setAuthStatus(false);
            app.setUserFeatures(null);
            userFeatures = null;
            renderLoginView();
        }
        catch (e) {

        }
    })

    document.querySelector(".show-modal").addEventListener("click", () => {
        try {
            chrome.tabs.sendMessage(app.getActiveTabId(), {type: "SHOWGUIDEMODAL"});
        }
        catch (e) {}
    })


    const upgradecta = document.querySelector("#upgradecta")
    upgradecta.addEventListener('click', () => {
        chrome.tabs.create({url: `${backend_url}package/aliexpress-media-downloader`});
        return false;
    })
}

const signInUser = () => {
    chrome.runtime.sendMessage({
        type:  'LOGIN'
    });
}

const renderLoginView = () => {
    if (!app.getAuthStatus()) {
        extContainerAuth.style.display = "block";
        extContainerDetails.style.display = "none";

        const signInCta = document.querySelector("#signin");
        signInCta.addEventListener("click", async (e) => {
            e.preventDefault();
            let username = document.querySelector("#extAuth-username");
            let password = document.querySelector("#extAuth-password");
            
            if (username.value && password.value) {

                let response = await makeRequest("api/token/", "POST", {
                    "username": username.value,
                    "password": password.value
                });
                if (response) {
                    chrome.storage.sync.set({ "access_token": response.access}, function(){});
                    chrome.storage.sync.set({ "refresh_token": response.refresh}, function(){});

                    if (app.getIsAllowedSite() && app.getActiveTabId()) {
                        chrome.tabs.sendMessage(app.getActiveTabId(), {
                            type: "USER_LOGGED_IN",
                            access_token: response.access,
                            refresh_token: response.refresh,
                        }, (response) => {
                            renderDetailsViews();
                        });
                    }
                    else {
                        reloadInterface();
                    }
                }
                else {
                    let errElem = document.querySelector("#popup-error-msg");
                    errElem.style.display = 'block';
                    errElem.textContent = "Invalid Data";
                }
            }
        });

        const signupcta = document.querySelector("#signup-extension")
        signupcta.addEventListener('click', () => signInUser());

        const socialcta =  document.querySelector("#signup-social-extension")
        socialcta.addEventListener('click', () => signInUser());

    } else {
        renderDetailsViews();
    }
}

const reloadInterface = () => {
    // get access and refresh tokens from storage and try to fetch user data
    chrome.storage.sync.get(['access_token', "refresh_token"], function(items){
        if (items.access_token && items.refresh_token) {
            // tokens found
            // check auth
            let response = checkAuth(items.access_token, items.refresh_token);
            if (response) {
                // if successfull the user is logged in automatically and the data view is renders
                response.then(data => {
                    app.setAuthStatus(true);
                    app.setUserFeatures(data); // store fetched data
                    userFeatures = data;
                    renderDetailsViews();
                })
            }
            else {
                // if not, the login view is renders
                renderLoginView();
            }
        }
        else {
            renderLoginView();
        }
    })
}

// a user clicks the popup activator
// the popup shows up. What interface should be reanders?

document.addEventListener("DOMContentLoaded", async () => {

    // user on allowed site (site with download pop up)
    const activeTab = await getCurrentTab();
    if ((activeTab.url && activeTab.url.includes("aliexpress.com/item")) || (activeTab.url && activeTab.url.includes("amazon.com/")) || activeTab.url && activeTab.url.includes("ebay.com/itm")) {
        app.setActiveTabId(activeTab.id);
        app.setIsAllowedSite(true);
    }
    else {
        app.setIsAllowedSite(false);
    }

    reloadInterface();
});

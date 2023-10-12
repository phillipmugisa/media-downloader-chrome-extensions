(() => {

    var backend_url = 'https://app.ilazy.net/';
    let source_name;

    class AppVariables {
        constructor () {
            this.isLoggedIn = null;
            this.userSubscriptionFeatures = null;
            this.source_name = null;
            this.new_user = false;
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

        setIsNewUser = (state) => {
            this.new_user = state;
        }

        getIsNewUser = () => this.new_user;
    }


    const app = new AppVariables();

    const getAmazonDomName = () => {
        document.querySelectorAll("h2").forEach(elem => {
            if (elem.textContent === "Product Description") {
                let parentElem = elem.parentElement;
                if (parentElem.querySelectorAll("img").length > 0) {
                    return `.${parentElem.classList.value.split(" ").join(".")}#${parentElem.id} img`
                }
            }
        })
    }

    const sites = {
        "gumroad.com" : {
            "Title" : "h1[itemprop='name']",
            "Price" : "[itemprop='price'] + [role='tooltip']",
            "Description": ".tiptap.ProseMirror",
            "Images" : ".preview-container.carousel img",
            "Rating" : ".rating-number",
            "Seller" : ".user",
            "body": "#product_page",
        },
    }
    
    // make requests
    const makeRequest = async (url, method, data) => {

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

    // check is access key and refresh token
    const checkAuth = async (obj=null) => {
        let access_token;
        let refresh_token;

        chrome.storage.sync.get(['manualLogout'], function(items){
            if (items.manualLogout) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                app.setAuthStatus(false);
                app.setUserFeatures(null);
                chrome.storage.sync.set({ "manualLogout": false}, function(){});
                renderDownloadInterFace();
                return;
            }
        })

        if (obj && obj.access_token && obj.refresh_token) {
            access_token = obj.access_token;
            refresh_token = obj.refresh_token;

            localStorage.setItem("access_token", access_token);
            localStorage.setItem("refresh_token", refresh_token);

        }
        else {
            if (!localStorage.getItem("access_token") && !localStorage.getItem("refresh_token")) {
                app.setAuthStatus(false);
                app.setUserFeatures(null);
                renderDownloadInterFace();
                return;
            }
            
            access_token = localStorage.getItem("access_token");
            refresh_token = localStorage.getItem("refresh_token");
            chrome.storage.sync.set({ "access_token": access_token}, function(){});
            chrome.storage.sync.set({ "refresh_token": refresh_token}, function(){});

        }

        // attempt login using access key
        let response = await makeRequest("api/subscriptions/gumroad/", "GET", {"access": access_token});
        if (response) {
            // if successful, render download features            
            app.setAuthStatus(true);
            app.setUserFeatures(response); // store fetched datas
            renderDownloadInterFace();
        }
        else {
            // else refresh token
            response = await makeRequest("api/token/refresh/", "POST", {"refresh": refresh_token});
            if (response) {
                // reset access token
                // update existing tokens in extension storage
                chrome.storage.sync.set({ "access_token": response.access}, function(){});
                chrome.storage.sync.set({ "refresh_token": refresh_token}, function(){});

                localStorage.setItem("access_token", response.access);
                localStorage.setItem("refresh_token", refresh_token);
                
                // rerun check to fetch features;
                checkAuth(obj=null);
            }
            else {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                app.setAuthStatus(false);
                app.setUserFeatures(null);
                renderDownloadInterFace();
            }
        }
    }

    const logout = () => {
        chrome.runtime.sendMessage({
            type:  'log_out_user',
            presist: true
        }, () => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            app.setAuthStatus(false);
            app.setUserFeatures(null);

            window.location.reload(); // will render with login button
        });
    }

    const logInUser = () => {
        chrome.runtime.sendMessage({
                type: 'LOGIN',
                presist: true
            }, () => {
        });
    }

    // on allowed site
    chrome.runtime.onMessage.addListener((obj, sender, sendResponse) => {        
        if (obj.type === "NEW_PRODUCT_LOADED") {
            app.setSourceName(obj.source_name);
            source_name = obj.source_name;
            app.setIsNewUser(obj.new_user ? true : false);

            let userVisitedAlready = localStorage.getItem("new_ilazy_user")
            if (!userVisitedAlready) {
                localStorage.setItem("new_ilazy_user", true);
            }

            if (app.getSourceName() === "amazon.com") {
                if (document.querySelector("#productTitle")) {
                    checkAuth(obj);
                }
            }
            else {
                checkAuth(obj);               
            }
        }
        else if (obj.type === "USER_LOGGED_IN") {
            localStorage.setItem("access_token", obj.access_token);
            localStorage.setItem("refresh_token", obj.refresh_token);
            checkAuth(obj)
            window.location.reload();
        }
        else if (obj.type === "LOGOUT") {
            logout();
        }
    })

    const renderDownloadInterFace = () => {
        const extensionComponentArea = document.querySelector("ext-component-area");

        if (!extensionComponentArea) {
            // if not exists
            const extensionComponentArea = document.createElement("div");            
            extensionComponentArea.className = "ext-component-area";

            const extensionComponentAreaCta = document.createElement("div");            
            extensionComponentAreaCta.className = "ext-component-area-cta";    

            extensionComponentArea.appendChild(extensionComponentAreaCta);

            // detect extension activator
            if (!document.getElementById('ext-activator')) {
                // add extension activator
                const extensionActivator = document.createElement('button');
                extensionActivator.id = 'ext-activator';
                extensionComponentAreaCta.appendChild(extensionActivator);


                // add download btn
                const downloadBtn = document.createElement("span");
                downloadBtn.className = "ext-download-btn";
                downloadBtn.addEventListener("click", handleDownload, false);
                // downloadBtn.textContent = "Download";
                extensionComponentAreaCta.appendChild(downloadBtn);

                extensionActivator.addEventListener("click",() =>  showSelectionPopup(extensionComponentArea, downloadBtn, app.getIsNewUser(), true));

                showSelectionPopup(extensionComponentArea, downloadBtn, app.getIsNewUser(), false)
            }

            let bodyElem = document.querySelector(sites[`${app.getSourceName()}`]['body']);
            bodyElem.appendChild(extensionComponentArea);

        }
        else {
            extensionComponentArea.parentElement.removeChild(extensionComponentArea);
            renderDownloadInterFace();
        }

    }

    const showSelectionPopup = (extensionComponentArea, downloadBtn, newUser, triggered) => {

        if (document.getElementById('selection-popup'))
        {
            let selectionPopup = document.getElementById('selection-popup');
            // reset form
            selectionPopup.querySelector('form').reset();
            extensionComponentArea.removeChild(selectionPopup);
            return;
        }

        const selectionPopup = document.createElement('div');
        selectionPopup.id = 'selection-popup';
        
        if (newUser || triggered) {
            extensionComponentArea.appendChild(selectionPopup);
            downloadBtn.style.display = "grid";
            chrome.storage.sync.set({ "new_user": false }, function(){});
        }

        // add pop up title
        const titleArea = document.createElement('div');
        titleArea.id = 'title-area';
        const title = document.createElement('h3');
        title.id = 'title';
        title.textContent = "Select Desired Features";
        
        titleArea.appendChild(title);
        selectionPopup.appendChild(titleArea);

        const popupForm = document.createElement('form');
        popupForm.id = 'popup-form';
        selectionPopup.appendChild(popupForm);

        const msg = document.createElement('b');
        msg.id = "extension-error-id";
        popupForm.appendChild(msg)

        const loginOverlay = document.createElement("div");
        loginOverlay.className = 'loginOverlay';
        loginOverlay.style.display = "none"; // not rendered by default

        const loginMsg = document.createElement("p");
        loginMsg.textContent = "Sign In to continue";
        loginOverlay.appendChild(loginMsg);
        const loginBtn = document.createElement("button");
        loginBtn.className = "loginBtn";
        loginBtn.textContent = "Login";
        loginOverlay.appendChild(loginBtn);

        loginBtn.addEventListener('click', () => {
            logInUser();
        })
        
        let formCheckBoxData = [];
        formCheckBoxData.push({'name': 'Title', 'label' : "Title"})
        formCheckBoxData.push({'name': 'Price', 'label' : "Price"})
        formCheckBoxData.push({'name': 'Description', 'label' : "Description"})
        formCheckBoxData.push({'name': 'Images', 'label' : "Images"})
        formCheckBoxData.push({'name': 'Rating', 'label' : "Rating"})
        formCheckBoxData.push({'name': 'Seller', 'label' : "Seller"})

        for (let key in sites[`${app.getSourceName()}`]) {
            if (!document.querySelectorAll(sites[`${app.getSourceName()}`][key])) {
                formCheckBoxData = formCheckBoxData.filter(checkbox => checkbox["name"] != key)
            }
        }
        
        for (let i=0; i < formCheckBoxData.length; i++) {
            let formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            // checkbox
            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = formCheckBoxData[i].name;
            checkbox.value = formCheckBoxData[i].label;
            checkbox.id = formCheckBoxData[i].name;
            checkbox.disabled = false;
            checkbox.checked = false;

            // label
            let label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = formCheckBoxData[i].label;
            
            formGroup.appendChild(checkbox);
            formGroup.appendChild(label);
            popupForm.appendChild(formGroup);
        }

        let itemsToBeenSelected = new Array();

        // check if user is logged in and user features were stores
        if ( app.getAuthStatus() && app.getUserFeatures() ) {
            loginOverlay.style.display = "none";
            if (localStorage.getItem('selected-items')) {
                itemsToBeenSelected = localStorage.getItem('selected-items').split(",");

	    	formCheckBoxData.forEach(obj => {
                if (!itemsToBeenSelected.includes(obj.label)) {
                    itemsToBeenSelected = itemsToBeenSelected.filter(itm => itm != obj.label)
                }
            })
            }
            else {
                localStorage.setItem('selected-items', formCheckBoxData.map(obj => obj.label))
                itemsToBeenSelected = formCheckBoxData.map(obj => obj.label)
            }

            popupForm.querySelectorAll('input')
            .forEach(input => {
                if (itemsToBeenSelected.includes(input.value)) {
                    input.checked = true;
                }
                if (app.getUserFeatures()['features'].includes(input.value)){
                    input.disabled = false;
                }
                else {
                    const formGroup = input.parentNode;
                    const link = document.createElement('a');
                    link.target = `_blank`;
                    link.href = `${backend_url}package`;
                    link.textContent = '(Go Pro)'
                    link.className = 'pro-link';
                    link.style.color = '#FF4747';
                    formGroup.appendChild(link)
                }
                input.addEventListener("input", () => {
                    itemsToBeenSelected = [];
                    if (!input.disabled) {
                        popupForm.querySelectorAll('input')
                        .forEach(input => {
                            if (input.checked) {
                                itemsToBeenSelected.push(input.value);
                            }
                        })
                        localStorage.setItem('selected-items', itemsToBeenSelected)
                    }
                })
            })
        }
        else {
            if (document.querySelector(".ext-download-btn")) {
                downloadBtn.parentNode.removeChild(downloadBtn);
            }
            selectionPopup.appendChild(loginOverlay);
            loginOverlay.style.display = "grid";
        }

    }

    const showPopUpError = (msg, persist=false) => {
        elem = document.querySelector("#extension-error-id");
        elem.textContent = msg;
        if(persist) return;
        setTimeout(() => {
            elem.textContent = '';
        }, 3000)
    }

    const handleDownload = () => {
        
        let selectedFeatures = new Array();
        if (localStorage.getItem('selected-items')) {
            selectedFeatures = localStorage.getItem('selected-items').split(",");
        }

        if (!selectedFeatures || selectedFeatures.length < 1) {
            showPopUpError("No Features Selected!");
            return;
        }

        if (app.getUserFeatures()) {        
            PRICING = app.getUserFeatures()['pricing'];

            if (PRICING.toLocaleLowerCase() == "Free".toLocaleLowerCase()) {
                downloadFreePackage(selectedFeatures);
            }
            else {
                // download main products
                if (selectedFeatures.includes("Images")) {
                    downloadProductImages();
                }
                if (selectedFeatures.includes("Title") || selectedFeatures.includes("Price") ||
                    selectedFeatures.includes("Description") || selectedFeatures.includes("Rating") ||
                    selectedFeatures.includes("Seller")) {
                    downloadProductDocs(selectedFeatures);
                }
            }
        }

    }

    const downloadFreePackage = (selectedFeatures) => {
        const modal = document.createElement('div');
        modal.className = "ext-modal"
        modal.innerHTML = `
            <button id='modal-close'>X</button>
            <div class="split">
                <div class="left">
            
                </div>
                <div class="right">
                <div class="spinner"></div>
                <div class='spinner-progress'>
                    <span id='spinner-percent'></span>
                    <span id="download-status">to start download.</span>
                </div>
                </div>
            </div>
        `
        
        document.body.classList.add('modalOpen')
        document.body.appendChild(modal)
        
        modal.querySelector("#modal-close").addEventListener("click", () => {
            document.body.classList.remove('modalOpen')
        })
        var percent = 10;
        
        modal.querySelector("#spinner-percent").textContent = `${percent}%`;
        function setPercent () {
            if (percent >= 100) {
                clearInterval(interval)

                // download main products
		try {
                	if (selectedFeatures.includes("Main product's images")) {
	                    downloadProductMain();
        	        }

                	if (selectedFeatures.includes("Variations images")) {
	                    downloadVariationImages();
        	        }
		} catch (e) {}
	    	 finally {
	                redirect_user()
		}

            } else {
                percent = percent + 10;
            }
            modal.querySelector("#spinner-percent").textContent = `${percent}%`;
        }
        let interval = setInterval(setPercent, 250);
    }

    function toJpeg (img){
        return new Promise(function (resolve) {
            var xhr = new XMLHttpRequest();
                xhr.open("get", img, true);
                xhr.responseType = "blob";
                xhr.onload = function () {
                    if (this.status == 200) {
                        var blob = this.response;
                        var oFileReader = new FileReader();
                        oFileReader.onloadend = function (e) {
                            // Create a new Image Obj
                            var newImg = new Image();
                            // Set crossOrigin Anonymous 
                            newImg.crossOrigin = "Anonymous";
                            newImg.onload = function() {
                                // Create a new Canvas
                                var canvas = document.createElement("canvas");
                                // Set 2D context
                                var context = canvas.getContext("2d");
                                // Set crossOrigin Anonymous 
                                canvas.crossOrigin = "anonymous";
                                // Set Width/Height
                                canvas.width = newImg.width;
                                canvas.height = newImg.height;
                                // Start
                                context.drawImage(newImg, 0, 0);
                                // Get jpeg Base64
                                resolve(canvas.toDataURL('image/jpeg'));
                            };
                            // Load Webp Base64
                            newImg.src = e.target.result;
                        };
                        oFileReader.readAsDataURL(blob);
                    }
                };
                xhr.send();
        })
    }

    const downloadProductImages = () => {

        let domElem = sites[`${app.getSourceName()}`]['Images'];

        let targetImages = document.querySelectorAll(domElem);
        if (targetImages != null && targetImages != undefined) {
            targetImages.forEach(image => {
                try {
                    toJpeg(image.src)
                        .then(url => {
                            performDownload(url, 'product-images', 'jpeg')
                    });                    

                } catch (e) {}
                });
        }
    }
    
    const downloadProductDocs =(selectedFeatures) => {
        console.log(selectedFeatures)
        // create doc and add selected data
        let docText = ""

        console.log(PRICING)
        console.log(document.querySelector(sites[`${app.getSourceName()}`]['Title']))
        console.log(document.querySelector(sites[`${app.getSourceName()}`]['Price']))
        console.log(document.querySelector(sites[`${app.getSourceName()}`]['Description']))
        console.log(document.querySelector(sites[`${app.getSourceName()}`]['Rating']))
        console.log(document.querySelector(sites[`${app.getSourceName()}`]['Seller']))

        if (selectedFeatures.includes("Title")) {
            docText = docText + `Title: ${document.querySelector(sites[`${app.getSourceName()}`]['Title']).textContent} \n\n`
        }
        if (selectedFeatures.includes("Price")) {
            docText = docText + `Price: ${document.querySelector(sites[`${app.getSourceName()}`]['Price']).textContent} \n\n`
        }
        if (selectedFeatures.includes("Description")) {
            docText = docText + `Description: ${document.querySelector(sites[`${app.getSourceName()}`]['Description']).textContent} \n\n`
        }
        if (selectedFeatures.includes("Rating")) {
            docText = docText + `Rating: ${document.querySelector(sites[`${app.getSourceName()}`]['Rating']).textContent} \n\n`
        }
        if (selectedFeatures.includes("Seller")) {
            docText = docText + `Seller: ${document.querySelector(sites[`${app.getSourceName()}`]['Seller']).textContent} \n\n`
        }
        docText = docText.trim().replace(/<br>/g, "\n\n")
        
        
        const blob = new Blob([docText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        
        performDownload(url, 'product-description', 'txt')
    }

    const performDownload = (imgUrl, subfolder, mediaType) => {
        let productName = document.querySelector(sites[`${app.getSourceName()}`]['Title']).textContent;
        // // trigger download
        chrome.runtime.sendMessage({
                type:  'DOWNLOAD',
                pricing:  PRICING,
                subfolder: subfolder,
                mediaType: mediaType,
                productName: productName.replace(/[\W_]/g, " ").slice(0,70),
                url: imgUrl
            }, () => {
        });
    }

    const redirect_user = () => {
        chrome.runtime.sendMessage({
            type:  'AD_REDIRECT',
            source:  app.getSourceName()
        }, () => {
        });
    }

})()


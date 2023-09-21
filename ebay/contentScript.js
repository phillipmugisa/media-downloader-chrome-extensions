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
        "aliexpress.com" : {
            "productTitle" : ".title--wrap--Ms9Zv4A h1",
            "body": ".hm-right",
            "mainProdImage": ".images-view-list img",
            "variationImages": {
                "main" : ".sku-item--skus--MmsF8fD img"
            },
            "descriptionImages": {
                "main": ".description--origin-part--SsZJoGC img",
                "alt": ".detail-extend-tab img",
            },
            "video": "video"
        },
        "amazon.com" : {
            "productTitle" : "#productTitle",
            "body": "#a-page",
            "mainProdImage": {
                "main" : "#altImages img",
                "alt" : "#thumbImages img"
            },
            "variationImages": {
                "main" : ".a-unordered-list.a-nostyle.a-button-list.a-declarative.a-button-toggle-group.a-horizontal.dimension-values-list img",
                "alt" : "#variation_color_name img"
            },
            // variation_color_name img
            "descriptionImages": {
                // "main": "div#aplus"
                "main" : getAmazonDomName()
                // "main": ".aplus-v2.desktop.celwidget img",
            // "alt": ".celwidget",
            },
            "video": "#altImages .a-spacing-small.item.videoThumbnail"
        },
        "ebay.com" : {
            "productTitle" : ".x-item-title__mainTitle span",
            "body": "body",
            "mainProdImage": "#PicturePanel img",
            // "variationImages": "#PicturePanel img",
            "descriptionImages": {
                // "main": ".pa_description_section_img img",
                // "main": "iframe#desc_ifr",
                "main": "iframe#desc_ifr img",
            },
            "video": "#altImages .a-spacing-small.item.videoThumbnail"
        }
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
        let response = await makeRequest("api/subscriptions/ebay/", "GET", {"access": access_token});
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
                // guide modal was not necessary
                // showGuideModal();
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
        
        if (obj.type === "SHOWGUIDEMODAL") {
            showGuideModal();
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
        // if (document.getElementById('selection-popup')) {
            formCheckBoxData.push({'name': 'main-image', 'label' : "Main product's images"})
            formCheckBoxData.push({'name': 'variation-images', 'label' : "Variations images"})
            formCheckBoxData.push({'name': 'description-images', 'label' : "Description images"})

            if (document.querySelectorAll(sites[`${app.getSourceName()}`]['video']).length > 0 && app.getSourceName() != "amazon.com") {
                formCheckBoxData.push({'name': 'product-videos', 'label' : "Main video"})
            }

	    if (sites[`${app.getSourceName()}`]['variationImages'] != undefined) {
	            if (document.querySelectorAll(sites[`${app.getSourceName()}`]['variationImages']['main']).length < 1 && document.querySelectorAll(sites[`${app.getSourceName()}`]['variationImages']['alt']).length < 1)
        	        formCheckBoxData = formCheckBoxData.filter(obj => obj.name != 'variation-images');
	    } else {
        	        formCheckBoxData = formCheckBoxData.filter(obj => obj.name != 'variation-images');
	    }

        if (app.getSourceName() === "amazon.com") {
            
            document.querySelectorAll("h2").forEach(elem => {
                if (elem.textContent === "Product Description") {
                    let parentElem = elem.parentElement;
                    if (parentElem.querySelectorAll("img").length <= 0) {
                        formCheckBoxData = formCheckBoxData.filter(obj => obj.name != 'description-images');
                    }
                }
            })
            if (document.querySelectorAll(sites[`${app.getSourceName()}`]['mainProdImage']['main']).length === 0 && document.querySelectorAll(sites[`${app.getSourceName()}`]['mainProdImage']['alt']).length === 0) {
                formCheckBoxData = formCheckBoxData.filter(obj => obj.name != 'main-image');
            }
        }
        else {
            if (document.querySelectorAll(sites[`${app.getSourceName()}`]['descriptionImages']['main']).length < 1 && document.querySelectorAll(sites[`${app.getSourceName()}`]['descriptionImages']['alt']).length < 1) {
                formCheckBoxData = formCheckBoxData.filter(obj => obj.name != 'description-images');
            }
            if (document.querySelectorAll(sites[`${app.getSourceName()}`]['mainProdImage']).length === 0) {
                formCheckBoxData = formCheckBoxData.filter(obj => obj.name != 'main-image');
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
                checkbox.disabled = true;
                checkbox.checked = false;

                // label
                let label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = formCheckBoxData[i].label;
                
                formGroup.appendChild(checkbox);
                formGroup.appendChild(label);
                popupForm.appendChild(formGroup);
            }
        // }

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
                    link.href = `${backend_url}package/aliexpress-media-downloader`;
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
                if (selectedFeatures.includes("Main product's images")) {
                    downloadProductMain();
                }
        
                // download variation image
                if (selectedFeatures.includes("Variations images")) {
                    downloadVariationImages();
                }
        
                // // download description images
                if (selectedFeatures.includes("Description images")) {
                    downloadDescriptionImages()
                }
        
                // download product video
                if (selectedFeatures.includes("Main video")) {
                    downloadProductVideos();
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

    const downloadProductMain = () => {

        let domElem;
        if (app.getSourceName() === "amazon.com") {
            if (document.querySelectorAll(sites[`${app.getSourceName()}`]['mainProdImage']['main']).length != 0) {
                domElem = sites[`${app.getSourceName()}`]['mainProdImage']['main'];
            }
            else if (document.querySelectorAll(sites[`${app.getSourceName()}`]['mainProdImage']['alt']).length != 0) {
                domElem = sites[`${app.getSourceName()}`]['mainProdImage']['alt'];
            }
        } else {
            domElem = sites[`${app.getSourceName()}`]['mainProdImage'];
        }

        let targetImages = document.querySelectorAll(domElem);
        if (targetImages != null && targetImages != undefined) {
            targetImages.forEach(image => {
                let imageSrc = image.src;
    
                let generateSrc;
                if (app.getSourceName() === "aliexpress.com") {
                    let linkParts = imageSrc.split('.');
                    generateSrc = `${linkParts[0]}.${linkParts[1]}.${linkParts[2]}.${linkParts[linkParts.length - 2].includes('png') ? 'png' : 'jpg'}`;
                }
                else if (app.getSourceName() === "amazon.com") {
                    if (imageSrc.includes("_AC_")) {
                        generateSrc = imageSrc.split('.').filter(item => !item.includes("_AC_")).join(".")
                    }
                    else if (imageSrc.includes("_SX38_SY50_CR")) {
                        generateSrc = imageSrc.split('.').filter(item => !item.includes("_SX38_SY50_CR")).join(".")
                    }
                }
                else if (app.getSourceName() === "ebay.com") {
                    generateSrc = imageSrc.split('s-l64').join("s-l500");
                }
    
                // to jpeg
                // download image
			try {
		                toJpeg(generateSrc)
        		            .then(url => {
                		        performDownload(url, 'product-images', 'jpeg')
	                    });                    

			} catch (e) {}
        	});
        }
    }

    const downloadVariationImages = () => { 

        let domElem = sites[`${app.getSourceName()}`]['variationImages']['main'];;
        let targetImages = document.querySelectorAll(domElem);

        if (targetImages.length < 1) {
            domElem = sites[`${app.getSourceName()}`]['variationImages']['alt'];
            targetImages = document.querySelectorAll(domElem);
        }

        if (targetImages != null && targetImages != undefined) {
            targetImages.forEach(image => {
                let imageSrc = image.src;
    
                if (!imageSrc.includes("gif")) {
                    let generateSrc;
                    if (app.getSourceName() === "aliexpress.com") {
                        let linkParts = imageSrc.split('.');
                        generateSrc = `${linkParts[0]}.${linkParts[1]}.${linkParts[2]}.${linkParts[linkParts.length - 2].includes('png') ? 'png' : 'jpg'}`;
                    }
                    else if (app.getSourceName() === "amazon.com") {
                        generateSrc = imageSrc.split('.').filter(item => !(item.split("_").length > 2)).join(".")
                    }
                    else if (app.getSourceName() === "ebay.com") {
                        generateSrc = imageSrc;
                    }
        
                    // to jpeg
                    // download image
                    toJpeg(generateSrc)
                        .then(url => {
                            performDownload(url, 'variation-imgs', 'jpeg')
                        });                    
                }
                });
        }
    }

    const downloadDescriptionImages = () => {
        let targetImages;

        if (app.getSourceName() === "amazon.com") {
            document.querySelectorAll("h2").forEach(elem => {
                if (elem.textContent === "Product Description") {
                    let parentElem = elem.parentElement;
                    if (parentElem.querySelectorAll("img").length > 0) {
                        targetImages = document.querySelectorAll(`.${parentElem.classList.value.split(" ").join(".")}#${parentElem.id} img`)
                    }
                }
            })

        } else {
            let domElem = sites[`${app.getSourceName()}`]['descriptionImages']['main'];
            targetImages = document.querySelectorAll(domElem);
    
            if (targetImages.length < 1) {
                domElem = sites[`${app.getSourceName()}`]['descriptionImages']['alt'];
                targetImages = document.querySelectorAll(domElem);
            }
        }


        if (targetImages != null && targetImages != undefined) {
            targetImages.forEach(image => {
                let imageSrc = image.src;
                if (!imageSrc.includes(".gif")) {
                    // get jpg src
                    let generateSrc;
                    if (app.getSourceName() === "aliexpress.com") {
                        let linkParts = imageSrc.split('.');
                        generateSrc = `${linkParts[0]}.${linkParts[1]}.${linkParts[2]}.${linkParts[linkParts.length - 2].includes('png') ? 'png' : 'jpg'}`;
                    }
                    else if (app.getSourceName() === "amazon.com") {
                        if (image.classList.contains("check-mark")) return;
                        generateSrc = imageSrc;
                    }

                    // to jpeg
                    // download image
    
                    toJpeg(generateSrc)
                        .then(url => performDownload(url, 'description-images', 'jpeg'));
                }
                
            })
        }
    }

    const downloadProductVideos = () => {
        let domElem = sites[`${app.getSourceName()}`]['video'];
        let videoElem;

        if (app.getSourceName() === "amazon.com") {
            return;
        } else {
            videoElem = document.querySelector(domElem);
            performDownload(videoElem.src, 'videos', 'mp4');
        }        
    }

    const performDownload = (imgUrl, subfolder, mediaType) => {
        let productName = document.querySelector(sites[`${app.getSourceName()}`]['productTitle']).textContent;
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

    const showGuideModal = () => {
        document.body.classList.add('modalOpen');
        let categoryIndex = 0;
        let categoryLength = {
            "aliexpress.com": 3,
            "amazon.com": 3,
            "ebay.com": 1,
        };

        let bodyElem = document.querySelector("html");
        
        const modal = document.createElement("div");
        modal.className = "guide-modal card";
        modal.innerHTML = `
        <header>
            <img src="https://ilazy.net/wp-content/uploads/2022/09/newLogoPSD.png" style="inline-size: 6rem;aspect-ratio: 2/.8;margin-left: 0.8rem;">
            <h1>ilazy Free Product Photo Image Video download</h1>
        </header>
        <main>
            <div class="description">
                <h3 id="description-title">Downloading Product Images</h3>
                <ul id="steps"></ul>
            </div>
            <div class="modal-img"></div>
        </main>
        <footer>
        <button id="previous">Previous</button>
        <button id="next">Next</button>
        <button id="skip">Skip</button>
        </footer>
        `;

        bodyElem.appendChild(modal);
        modal.classList.add("show");
        nextCategory(modal, index=categoryIndex);
        
        const modalSkipCta = modal.querySelector("#skip");
        const modalNextCta = modal.querySelector("#next");
        const modalPreviousCta = modal.querySelector("#previous");


        if (categoryIndex == categoryLength[source_name] - 1) {
            modalNextCta.textContent = "close";
            modalSkipCta.classList.add("hidden");
            // modalNextCta.disabled = true;
        }

        modalNextCta.addEventListener("click", () => {
            if (modalNextCta.textContent === "close" && categoryIndex == categoryLength[source_name] - 1) {
                modal.classList.remove("show");
                document.body.classList.remove('modalOpen');
            }
            else if (categoryIndex < categoryLength[source_name] - 1) {
                categoryIndex = categoryIndex + 1;
                nextCategory(modal, index=categoryIndex);

                if (categoryIndex == categoryLength[source_name] - 1) {
                    modalNextCta.textContent = "close";
                    modalSkipCta.classList.add("hidden");
                    // modalNextCta.disabled = true;
                }
            }

            if (categoryIndex > 0 && !modalPreviousCta.classList.contains("show")) {
                modalPreviousCta.classList.add("show");
            }
        });

        modalPreviousCta.addEventListener("click", () => {

            if (categoryIndex > 0) {
                categoryIndex = categoryIndex - 1;
                nextCategory(modal, index=categoryIndex);
                modalNextCta.textContent = "Next";

                if (modalSkipCta.classList.contains("hidden")) {
                    modalSkipCta.classList.remove("hidden");
                }
            }
            if (categoryIndex == 0) {
                modalPreviousCta.classList.remove("show");
            }
        });

        modalSkipCta.addEventListener("click", () => {
            modal.classList.remove("show");
            document.body.classList.remove('modalOpen');
        });
    }

    const renderModalCategory = (modalElem, categoryData) => {
        const description = modalElem.querySelector(".description");
        const modalImg = modalElem.querySelector(".modal-img");
        
        const descriptionTitle = description.querySelector(".description #description-title");
        const descriptionList = description.querySelector(".description #steps");

        // refresh ui
        descriptionTitle.innerHTML = "";
        descriptionList.innerHTML = "";
        modalImg.innerHTML = "";

        descriptionTitle.textContent = `Downloading ${categoryData["title"]}`;

        categoryData["data"].forEach(data => {
            let listElem = document.createElement("li");
            listElem.textContent = `${data}`;
            descriptionList.appendChild(listElem);
        })

        modalImg.appendChild(categoryData['svg']);
    }

    const nextCategory = (modalElem, index) => {

        let aliExpressProd = document.createElement("div");
        aliExpressProd.innerHTML = `
        <svg width="527" height="265" viewBox="0 0 527 265" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="202" height="184" fill="#B3B3B3"/>
            <rect x="10" y="214" width="42" height="42" fill="#B3B3B3"/>
            <rect x="61" y="214" width="45" height="42" fill="#B3B3B3"/>
            <rect x="115" y="214" width="44" height="42" fill="#B3B3B3"/>
            <rect x="168" y="214" width="44" height="42" fill="#B3B3B3"/>
            <rect x="250" y="10" width="257" height="9" fill="#F8F8F8"/>
            <rect x="250" y="39" width="226" height="9" fill="#F8F8F8"/>
            <rect x="250" y="68" width="202" height="9" fill="#F8F8F8"/>
            <rect x="250" y="97" width="126" height="9" fill="#F8F8F8"/>
            <rect x="250" y="126" width="104" height="9" fill="#F8F8F8"/>
            <rect x="250" y="155" width="50" height="47" fill="#F8F8F8"/>
            <rect x="317" y="155" width="52" height="47" fill="#F8F8F8"/>
            <rect x="386" y="155" width="51" height="47" fill="#F8F8F8"/>
            <rect x="454" y="155" width="53" height="47" fill="#F8F8F8"/>
            <rect x="0.5" y="0.5" width="526" height="264" stroke="#EBDDDD"/>
        </svg>
        `;
        let aliExpressVar = document.createElement("div");
        aliExpressVar.innerHTML = `
        <svg width="527" height="265" viewBox="0 0 527 265" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="202" height="184" fill="#F8F8F8"/>
            <rect x="10" y="214" width="42" height="42" fill="#F8F8F8"/>
            <rect x="61" y="214" width="45" height="42" fill="#F8F8F8"/>
            <rect x="115" y="214" width="44" height="42" fill="#F8F8F8"/>
            <rect x="168" y="214" width="44" height="42" fill="#F8F8F8"/>
            <rect x="250" y="10" width="257" height="9" fill="#F8F8F8"/>
            <rect x="250" y="39" width="226" height="9" fill="#F8F8F8"/>
            <rect x="250" y="68" width="202" height="9" fill="#F8F8F8"/>
            <rect x="250" y="97" width="126" height="9" fill="#F8F8F8"/>
            <rect x="250" y="126" width="104" height="9" fill="#F8F8F8"/>
            <rect x="250" y="155" width="50" height="47" fill="#B3B3B3"/>
            <rect x="317" y="155" width="52" height="47" fill="#B3B3B3"/>
            <rect x="386" y="155" width="51" height="47" fill="#B3B3B3"/>
            <rect x="454" y="155" width="53" height="47" fill="#B3B3B3"/>
            <rect x="0.5" y="0.5" width="526" height="264" stroke="#EBDDDD"/>
        </svg>
        `;
        let aliExpressDesc = document.createElement("div");
        aliExpressDesc.innerHTML = `
        <svg width="526" height="319" viewBox="0 0 526 319" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="100" height="299" fill="#F8F8F8"/>
            <rect x="128" y="10" width="388" height="91" fill="#B3B3B3"/>
            <rect x="128" y="121" width="388" height="98" fill="#B3B3B3"/>
            <rect x="128" y="239" width="388" height="65" fill="#B3B3B3"/>
            <rect x="0.5" y="0.5" width="525" height="318" stroke="#EBDDDD"/>
        </svg>        
        `;


        let ebayProd = document.createElement("div");
        ebayProd.innerHTML = `
        <svg width="509" height="215" viewBox="0 0 509 215" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="42" height="42" fill="#B3B3B3"/>
            <rect x="10" y="61" width="45" height="42" fill="#B3B3B3"/>
            <rect x="10" y="112" width="44" height="42" fill="#B3B3B3"/>
            <rect x="10" y="163" width="44" height="42" fill="#B3B3B3"/>
            <rect x="65" y="10" width="202" height="195" fill="#B3B3B3"/>
            <rect x="287" y="10" width="212" height="9" fill="#F8F8F8"/>
            <rect x="287" y="24" width="186" height="9" fill="#F8F8F8"/>
            <rect x="287" y="38" width="167" height="9" fill="#F8F8F8"/>
            <rect x="287" y="52" width="104" height="9" fill="#F8F8F8"/>
            <rect x="287" y="66" width="86" height="9" fill="#F8F8F8"/>
            <rect x="0.5" y="0.5" width="508" height="214" stroke="#F8F8F8"/>
        </svg>                      
        `;

        let amazonProd = document.createElement("div");
        amazonProd.innerHTML = `
        <svg width="554" height="215" viewBox="0 0 554 215" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="42" height="42" fill="#B3B3B3"/>
            <rect x="10" y="61" width="45" height="42" fill="#B3B3B3"/>
            <rect x="10" y="112" width="44" height="42" fill="#B3B3B3"/>
            <rect x="10" y="163" width="44" height="42" fill="#B3B3B3"/>
            <rect x="65" y="10" width="202" height="195" fill="#B3B3B3"/>
            <rect x="287" y="11.5" width="257" height="9" fill="#F8F8F8"/>
            <rect x="287" y="40.5" width="226" height="9" fill="#F8F8F8"/>
            <rect x="287" y="69.5" width="202" height="9" fill="#F8F8F8"/>
            <rect x="287" y="98.5" width="126" height="9" fill="#F8F8F8"/>
            <rect x="287" y="127.5" width="104" height="9" fill="#F8F8F8"/>
            <rect x="287" y="156.5" width="50" height="47" fill="#F8F8F8"/>
            <rect x="347" y="156.5" width="52" height="47" fill="#F8F8F8"/>
            <rect x="409" y="156.5" width="51" height="47" fill="#F8F8F8"/>
            <rect x="470" y="156.5" width="53" height="47" fill="#F8F8F8"/>
            <rect x="0.5" y="0.5" width="553" height="214" stroke="#F8F8F8"/>
        </svg>        
        `;
        let amazonVar = document.createElement("div");
        amazonVar.innerHTML = `
        <svg width="554" height="215" viewBox="0 0 554 215" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="10" width="42" height="42" fill="#F8F8F8"/>
            <rect x="10" y="61" width="45" height="42" fill="#F8F8F8"/>
            <rect x="10" y="112" width="44" height="42" fill="#F8F8F8"/>
            <rect x="10" y="163" width="44" height="42" fill="#F8F8F8"/>
            <rect x="65" y="10" width="202" height="195" fill="#F8F8F8"/>
            <rect x="287" y="11.5" width="257" height="9" fill="#F8F8F8"/>
            <rect x="287" y="40.5" width="226" height="9" fill="#F8F8F8"/>
            <rect x="287" y="69.5" width="202" height="9" fill="#F8F8F8"/>
            <rect x="287" y="98.5" width="126" height="9" fill="#F8F8F8"/>
            <rect x="287" y="127.5" width="104" height="9" fill="#F8F8F8"/>
            <rect x="287" y="156.5" width="50" height="47" fill="#B3B3B3"/>
            <rect x="347" y="156.5" width="52" height="47" fill="#B3B3B3"/>
            <rect x="409" y="156.5" width="51" height="47" fill="#B3B3B3"/>
            <rect x="470" y="156.5" width="53" height="47" fill="#B3B3B3"/>
            <rect x="0.5" y="0.5" width="553" height="214" stroke="#F8F8F8"/>
        </svg>        
        `;
        let amazonDesc = document.createElement("div");
        amazonDesc.innerHTML = `
        <svg width="465" height="313" viewBox="0 0 465 313" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M60.7585 22V13.2727H64.2017C64.8636 13.2727 65.4276 13.3991 65.8935 13.652C66.3594 13.902 66.7145 14.25 66.9588 14.696C67.206 15.1392 67.3295 15.6506 67.3295 16.2301C67.3295 16.8097 67.2045 17.321 66.9545 17.7642C66.7045 18.2074 66.3423 18.5526 65.8679 18.7997C65.3963 19.0469 64.8253 19.1705 64.1548 19.1705H61.9602V17.6918H63.8565C64.2116 17.6918 64.5043 17.6307 64.7344 17.5085C64.9673 17.3835 65.1406 17.2116 65.2543 16.9929C65.3707 16.7713 65.429 16.517 65.429 16.2301C65.429 15.9403 65.3707 15.6875 65.2543 15.4716C65.1406 15.2528 64.9673 15.0838 64.7344 14.9645C64.5014 14.8423 64.206 14.7812 63.848 14.7812H62.6037V22H60.7585ZM68.494 22V15.4545H70.2539V16.5966H70.3221C70.4414 16.1903 70.6417 15.8835 70.9229 15.6761C71.2042 15.4659 71.5281 15.3608 71.8945 15.3608C71.9854 15.3608 72.0835 15.3665 72.1886 15.3778C72.2937 15.3892 72.386 15.4048 72.4656 15.4247V17.0355C72.3803 17.0099 72.2624 16.9872 72.1119 16.9673C71.9613 16.9474 71.8235 16.9375 71.6985 16.9375C71.4315 16.9375 71.1928 16.9957 70.9826 17.1122C70.7752 17.2259 70.6104 17.3849 70.4883 17.5895C70.369 17.794 70.3093 18.0298 70.3093 18.2969V22H68.494ZM76.0568 22.1278C75.3949 22.1278 74.8224 21.9872 74.3395 21.706C73.8594 21.4219 73.4886 21.027 73.2273 20.5213C72.9659 20.0128 72.8352 19.4233 72.8352 18.7528C72.8352 18.0767 72.9659 17.4858 73.2273 16.9801C73.4886 16.4716 73.8594 16.0767 74.3395 15.7955C74.8224 15.5114 75.3949 15.3693 76.0568 15.3693C76.7188 15.3693 77.2898 15.5114 77.7699 15.7955C78.2528 16.0767 78.625 16.4716 78.8864 16.9801C79.1477 17.4858 79.2784 18.0767 79.2784 18.7528C79.2784 19.4233 79.1477 20.0128 78.8864 20.5213C78.625 21.027 78.2528 21.4219 77.7699 21.706C77.2898 21.9872 76.7188 22.1278 76.0568 22.1278ZM76.0653 20.7216C76.3665 20.7216 76.6179 20.6364 76.8196 20.4659C77.0213 20.2926 77.1733 20.0568 77.2756 19.7585C77.3807 19.4602 77.4332 19.1207 77.4332 18.7401C77.4332 18.3594 77.3807 18.0199 77.2756 17.7216C77.1733 17.4233 77.0213 17.1875 76.8196 17.0142C76.6179 16.8409 76.3665 16.7543 76.0653 16.7543C75.7614 16.7543 75.5057 16.8409 75.2983 17.0142C75.0938 17.1875 74.9389 17.4233 74.8338 17.7216C74.7315 18.0199 74.6804 18.3594 74.6804 18.7401C74.6804 19.1207 74.7315 19.4602 74.8338 19.7585C74.9389 20.0568 75.0938 20.2926 75.2983 20.4659C75.5057 20.6364 75.7614 20.7216 76.0653 20.7216ZM82.8707 22.1065C82.3736 22.1065 81.9233 21.9787 81.5199 21.723C81.1193 21.4645 80.8011 21.0852 80.5653 20.5852C80.3324 20.0824 80.2159 19.4659 80.2159 18.7358C80.2159 17.9858 80.3366 17.3622 80.5781 16.8651C80.8196 16.3651 81.1406 15.9915 81.5412 15.7443C81.9446 15.4943 82.3864 15.3693 82.8665 15.3693C83.233 15.3693 83.5384 15.4318 83.7827 15.5568C84.0298 15.679 84.2287 15.8324 84.3793 16.017C84.5327 16.1989 84.6491 16.3778 84.7287 16.554H84.7841V13.2727H86.5952V22H84.8054V20.9517H84.7287C84.6435 21.1335 84.5227 21.3139 84.3665 21.4929C84.2131 21.669 84.0128 21.8153 83.7656 21.9318C83.5213 22.0483 83.223 22.1065 82.8707 22.1065ZM83.446 20.6619C83.7386 20.6619 83.9858 20.5824 84.1875 20.4233C84.392 20.2614 84.5483 20.0355 84.6562 19.7457C84.767 19.456 84.8224 19.1165 84.8224 18.7273C84.8224 18.3381 84.7685 18 84.6605 17.7131C84.5526 17.4261 84.3963 17.2045 84.1918 17.0483C83.9872 16.892 83.7386 16.8139 83.446 16.8139C83.1477 16.8139 82.8963 16.8949 82.6918 17.0568C82.4872 17.2187 82.3324 17.4432 82.2273 17.7301C82.1222 18.017 82.0696 18.3494 82.0696 18.7273C82.0696 19.108 82.1222 19.4446 82.2273 19.7372C82.3352 20.027 82.4901 20.2543 82.6918 20.419C82.8963 20.581 83.1477 20.6619 83.446 20.6619ZM92.2852 19.2131V15.4545H94.1005V22H92.3576V20.8111H92.2894C92.1417 21.1946 91.896 21.5028 91.5522 21.7358C91.2113 21.9687 90.7951 22.0852 90.3036 22.0852C89.8661 22.0852 89.4812 21.9858 89.1488 21.7869C88.8164 21.5881 88.5565 21.3054 88.369 20.9389C88.1843 20.5724 88.0906 20.1335 88.0877 19.6222V15.4545H89.9031V19.2983C89.9059 19.6847 90.0096 19.9901 90.2141 20.2145C90.4187 20.4389 90.6928 20.5511 91.0366 20.5511C91.2553 20.5511 91.4599 20.5014 91.6502 20.402C91.8406 20.2997 91.994 20.1491 92.1104 19.9503C92.2298 19.7514 92.288 19.5057 92.2852 19.2131ZM98.5099 22.1278C97.8395 22.1278 97.2628 21.9858 96.7798 21.7017C96.2997 21.4148 95.9304 21.017 95.6719 20.5085C95.4162 20 95.2884 19.4148 95.2884 18.7528C95.2884 18.0824 95.4176 17.4943 95.6761 16.9886C95.9375 16.4801 96.3082 16.0838 96.7884 15.7997C97.2685 15.5128 97.8395 15.3693 98.5014 15.3693C99.0724 15.3693 99.5724 15.473 100.001 15.6804C100.43 15.8878 100.77 16.179 101.02 16.554C101.27 16.929 101.408 17.3693 101.433 17.875H99.7202C99.6719 17.5483 99.544 17.2855 99.3366 17.0866C99.1321 16.8849 98.8636 16.7841 98.5312 16.7841C98.25 16.7841 98.0043 16.8608 97.794 17.0142C97.5866 17.1648 97.4247 17.3849 97.3082 17.6747C97.1918 17.9645 97.1335 18.3153 97.1335 18.7273C97.1335 19.1449 97.1903 19.5 97.304 19.7926C97.4205 20.0852 97.5838 20.3082 97.794 20.4616C98.0043 20.6151 98.25 20.6918 98.5312 20.6918C98.7386 20.6918 98.9247 20.6491 99.0895 20.5639C99.2571 20.4787 99.3949 20.3551 99.5028 20.1932C99.6136 20.0284 99.6861 19.831 99.7202 19.6009H101.433C101.405 20.1009 101.268 20.5412 101.024 20.9219C100.783 21.2997 100.449 21.5952 100.023 21.8082C99.5966 22.0213 99.0923 22.1278 98.5099 22.1278ZM106.077 15.4545V16.8182H102.135V15.4545H106.077ZM103.03 13.8864H104.846V19.9886C104.846 20.1562 104.871 20.2869 104.922 20.3807C104.973 20.4716 105.044 20.5355 105.135 20.5724C105.229 20.6094 105.337 20.6278 105.459 20.6278C105.544 20.6278 105.63 20.6207 105.715 20.6065C105.8 20.5895 105.865 20.5767 105.911 20.5682L106.196 21.919C106.105 21.9474 105.978 21.9801 105.813 22.017C105.648 22.0568 105.448 22.081 105.212 22.0895C104.775 22.1065 104.391 22.0483 104.061 21.9148C103.735 21.7812 103.48 21.5739 103.299 21.2926C103.117 21.0114 103.027 20.6562 103.03 20.2273V13.8864ZM113.165 22H110.071V13.2727H113.19C114.068 13.2727 114.824 13.4474 115.457 13.7969C116.091 14.1435 116.578 14.642 116.919 15.2926C117.263 15.9432 117.435 16.7216 117.435 17.6278C117.435 18.5369 117.263 19.3182 116.919 19.9716C116.578 20.625 116.088 21.1264 115.449 21.4759C114.812 21.8253 114.051 22 113.165 22ZM111.916 20.419H113.088C113.634 20.419 114.092 20.3224 114.464 20.1293C114.839 19.9332 115.121 19.6307 115.308 19.2216C115.499 18.8097 115.594 18.2784 115.594 17.6278C115.594 16.983 115.499 16.456 115.308 16.0469C115.121 15.6378 114.841 15.3366 114.469 15.1435C114.097 14.9503 113.638 14.8537 113.092 14.8537H111.916V20.419ZM121.75 22.1278C121.077 22.1278 120.498 21.9915 120.012 21.7188C119.529 21.4432 119.157 21.054 118.895 20.5511C118.634 20.0455 118.503 19.4474 118.503 18.7571C118.503 18.0838 118.634 17.4929 118.895 16.9844C119.157 16.4759 119.525 16.0795 119.999 15.7955C120.476 15.5114 121.036 15.3693 121.678 15.3693C122.11 15.3693 122.512 15.4389 122.884 15.5781C123.259 15.7145 123.586 15.9205 123.864 16.196C124.145 16.4716 124.364 16.8182 124.52 17.2358C124.676 17.6506 124.755 18.1364 124.755 18.6932V19.1918H119.228V18.0668H123.046C123.046 17.8054 122.989 17.5739 122.875 17.3722C122.762 17.1705 122.604 17.0128 122.402 16.8991C122.203 16.7827 121.972 16.7244 121.708 16.7244C121.432 16.7244 121.188 16.7884 120.975 16.9162C120.765 17.0412 120.6 17.2102 120.48 17.4233C120.361 17.6335 120.3 17.8679 120.297 18.1264V19.196C120.297 19.5199 120.357 19.7997 120.476 20.0355C120.598 20.2713 120.77 20.4531 120.992 20.581C121.213 20.7088 121.476 20.7727 121.78 20.7727C121.982 20.7727 122.167 20.7443 122.334 20.6875C122.502 20.6307 122.645 20.5455 122.765 20.4318C122.884 20.3182 122.975 20.179 123.037 20.0142L124.716 20.125C124.631 20.5284 124.456 20.8807 124.192 21.1818C123.931 21.4801 123.593 21.7131 123.178 21.8807C122.766 22.0455 122.29 22.1278 121.75 22.1278ZM131.385 17.321L129.723 17.4233C129.695 17.2812 129.634 17.1534 129.54 17.0398C129.446 16.9233 129.323 16.831 129.169 16.7628C129.019 16.6918 128.838 16.6562 128.628 16.6562C128.347 16.6562 128.11 16.7159 127.917 16.8352C127.723 16.9517 127.627 17.108 127.627 17.304C127.627 17.4602 127.689 17.5923 127.814 17.7003C127.939 17.8082 128.154 17.8949 128.458 17.9602L129.642 18.1989C130.279 18.3295 130.753 18.5398 131.066 18.8295C131.378 19.1193 131.534 19.5 131.534 19.9716C131.534 20.4006 131.408 20.777 131.155 21.1009C130.905 21.4247 130.561 21.6776 130.124 21.8594C129.689 22.0384 129.188 22.1278 128.62 22.1278C127.753 22.1278 127.063 21.9474 126.549 21.5866C126.037 21.223 125.738 20.7287 125.65 20.1037L127.435 20.0099C127.489 20.2741 127.62 20.4759 127.827 20.6151C128.034 20.7514 128.3 20.8196 128.624 20.8196C128.942 20.8196 129.198 20.7585 129.391 20.6364C129.587 20.5114 129.686 20.3509 129.689 20.1548C129.686 19.9901 129.617 19.8551 129.48 19.75C129.344 19.642 129.134 19.5597 128.85 19.5028L127.716 19.277C127.077 19.1491 126.601 18.9276 126.289 18.6122C125.979 18.2969 125.824 17.8949 125.824 17.4062C125.824 16.9858 125.938 16.6236 126.165 16.3196C126.395 16.0156 126.718 15.7812 127.132 15.6165C127.55 15.4517 128.039 15.3693 128.598 15.3693C129.425 15.3693 130.076 15.544 130.55 15.8935C131.027 16.2429 131.306 16.7187 131.385 17.321ZM135.635 22.1278C134.964 22.1278 134.388 21.9858 133.905 21.7017C133.425 21.4148 133.055 21.017 132.797 20.5085C132.541 20 132.413 19.4148 132.413 18.7528C132.413 18.0824 132.543 17.4943 132.801 16.9886C133.063 16.4801 133.433 16.0838 133.913 15.7997C134.393 15.5128 134.964 15.3693 135.626 15.3693C136.197 15.3693 136.697 15.473 137.126 15.6804C137.555 15.8878 137.895 16.179 138.145 16.554C138.395 16.929 138.533 17.3693 138.558 17.875H136.845C136.797 17.5483 136.669 17.2855 136.462 17.0866C136.257 16.8849 135.989 16.7841 135.656 16.7841C135.375 16.7841 135.129 16.8608 134.919 17.0142C134.712 17.1648 134.55 17.3849 134.433 17.6747C134.317 17.9645 134.259 18.3153 134.259 18.7273C134.259 19.1449 134.315 19.5 134.429 19.7926C134.545 20.0852 134.709 20.3082 134.919 20.4616C135.129 20.6151 135.375 20.6918 135.656 20.6918C135.864 20.6918 136.05 20.6491 136.214 20.5639C136.382 20.4787 136.52 20.3551 136.628 20.1932C136.739 20.0284 136.811 19.831 136.845 19.6009H138.558C138.53 20.1009 138.393 20.5412 138.149 20.9219C137.908 21.2997 137.574 21.5952 137.148 21.8082C136.722 22.0213 136.217 22.1278 135.635 22.1278ZM139.721 22V15.4545H141.48V16.5966H141.549C141.668 16.1903 141.868 15.8835 142.15 15.6761C142.431 15.4659 142.755 15.3608 143.121 15.3608C143.212 15.3608 143.31 15.3665 143.415 15.3778C143.52 15.3892 143.613 15.4048 143.692 15.4247V17.0355C143.607 17.0099 143.489 16.9872 143.338 16.9673C143.188 16.9474 143.05 16.9375 142.925 16.9375C142.658 16.9375 142.419 16.9957 142.209 17.1122C142.002 17.2259 141.837 17.3849 141.715 17.5895C141.596 17.794 141.536 18.0298 141.536 18.2969V22H139.721ZM144.631 22V15.4545H146.446V22H144.631ZM145.543 14.6108C145.273 14.6108 145.041 14.5213 144.848 14.3423C144.658 14.1605 144.562 13.9432 144.562 13.6903C144.562 13.4403 144.658 13.2259 144.848 13.0469C145.041 12.8651 145.273 12.7741 145.543 12.7741C145.813 12.7741 146.043 12.8651 146.233 13.0469C146.426 13.2259 146.523 13.4403 146.523 13.6903C146.523 13.9432 146.426 14.1605 146.233 14.3423C146.043 14.5213 145.813 14.6108 145.543 14.6108ZM147.9 24.4545V15.4545H149.69V16.554H149.771C149.85 16.3778 149.966 16.1989 150.116 16.017C150.27 15.8324 150.468 15.679 150.713 15.5568C150.96 15.4318 151.267 15.3693 151.633 15.3693C152.11 15.3693 152.551 15.4943 152.954 15.7443C153.358 15.9915 153.68 16.3651 153.922 16.8651C154.163 17.3622 154.284 17.9858 154.284 18.7358C154.284 19.4659 154.166 20.0824 153.93 20.5852C153.697 21.0852 153.379 21.4645 152.975 21.723C152.575 21.9787 152.126 22.1065 151.629 22.1065C151.277 22.1065 150.977 22.0483 150.73 21.9318C150.485 21.8153 150.285 21.669 150.129 21.4929C149.973 21.3139 149.853 21.1335 149.771 20.9517H149.716V24.4545H147.9ZM149.677 18.7273C149.677 19.1165 149.731 19.456 149.839 19.7457C149.947 20.0355 150.103 20.2614 150.308 20.4233C150.512 20.5824 150.761 20.6619 151.054 20.6619C151.349 20.6619 151.599 20.581 151.804 20.419C152.008 20.2543 152.163 20.027 152.268 19.7372C152.376 19.4446 152.43 19.108 152.43 18.7273C152.43 18.3494 152.377 18.017 152.272 17.7301C152.167 17.4432 152.012 17.2187 151.808 17.0568C151.603 16.8949 151.352 16.8139 151.054 16.8139C150.758 16.8139 150.508 16.892 150.304 17.0483C150.102 17.2045 149.947 17.4261 149.839 17.7131C149.731 18 149.677 18.3381 149.677 18.7273ZM158.975 15.4545V16.8182H155.034V15.4545H158.975ZM155.929 13.8864H157.744V19.9886C157.744 20.1562 157.77 20.2869 157.821 20.3807C157.872 20.4716 157.943 20.5355 158.034 20.5724C158.127 20.6094 158.235 20.6278 158.358 20.6278C158.443 20.6278 158.528 20.6207 158.613 20.6065C158.699 20.5895 158.764 20.5767 158.809 20.5682L159.095 21.919C159.004 21.9474 158.876 21.9801 158.711 22.017C158.547 22.0568 158.346 22.081 158.11 22.0895C157.673 22.1065 157.289 22.0483 156.96 21.9148C156.633 21.7812 156.379 21.5739 156.197 21.2926C156.015 21.0114 155.926 20.6562 155.929 20.2273V13.8864ZM160.158 22V15.4545H161.973V22H160.158ZM161.07 14.6108C160.8 14.6108 160.569 14.5213 160.375 14.3423C160.185 14.1605 160.09 13.9432 160.09 13.6903C160.09 13.4403 160.185 13.2259 160.375 13.0469C160.569 12.8651 160.8 12.7741 161.07 12.7741C161.34 12.7741 161.57 12.8651 161.76 13.0469C161.953 13.2259 162.05 13.4403 162.05 13.6903C162.05 13.9432 161.953 14.1605 161.76 14.3423C161.57 14.5213 161.34 14.6108 161.07 14.6108ZM166.385 22.1278C165.723 22.1278 165.151 21.9872 164.668 21.706C164.188 21.4219 163.817 21.027 163.555 20.5213C163.294 20.0128 163.163 19.4233 163.163 18.7528C163.163 18.0767 163.294 17.4858 163.555 16.9801C163.817 16.4716 164.188 16.0767 164.668 15.7955C165.151 15.5114 165.723 15.3693 166.385 15.3693C167.047 15.3693 167.618 15.5114 168.098 15.7955C168.581 16.0767 168.953 16.4716 169.214 16.9801C169.476 17.4858 169.607 18.0767 169.607 18.7528C169.607 19.4233 169.476 20.0128 169.214 20.5213C168.953 21.027 168.581 21.4219 168.098 21.706C167.618 21.9872 167.047 22.1278 166.385 22.1278ZM166.393 20.7216C166.695 20.7216 166.946 20.6364 167.148 20.4659C167.349 20.2926 167.501 20.0568 167.604 19.7585C167.709 19.4602 167.761 19.1207 167.761 18.7401C167.761 18.3594 167.709 18.0199 167.604 17.7216C167.501 17.4233 167.349 17.1875 167.148 17.0142C166.946 16.8409 166.695 16.7543 166.393 16.7543C166.089 16.7543 165.834 16.8409 165.626 17.0142C165.422 17.1875 165.267 17.4233 165.162 17.7216C165.06 18.0199 165.009 18.3594 165.009 18.7401C165.009 19.1207 165.06 19.4602 165.162 19.7585C165.267 20.0568 165.422 20.2926 165.626 20.4659C165.834 20.6364 166.089 20.7216 166.393 20.7216ZM172.602 18.2159V22H170.787V15.4545H172.517V16.6094H172.594C172.739 16.2287 172.982 15.9276 173.322 15.706C173.663 15.4815 174.077 15.3693 174.562 15.3693C175.017 15.3693 175.413 15.4688 175.751 15.6676C176.089 15.8665 176.352 16.1506 176.54 16.5199C176.727 16.8864 176.821 17.3239 176.821 17.8324V22H175.006V18.1562C175.009 17.7557 174.906 17.4432 174.699 17.2188C174.491 16.9915 174.206 16.8778 173.842 16.8778C173.598 16.8778 173.382 16.9304 173.195 17.0355C173.01 17.1406 172.865 17.294 172.76 17.4957C172.658 17.6946 172.605 17.9347 172.602 18.2159Z" fill="black"/>
            <rect x="60" y="35" width="345" height="129" fill="#B3B3B3"/>
            <rect x="60" y="174" width="345" height="129" fill="#B3B3B3"/>
            <rect x="0.5" y="0.5" width="464" height="312" stroke="#F8F8F8"/>
        </svg>               
        `;

        const data = {
            "aliexpress.com" : {
                categories: [
                    {
                        title: "Product Images",
                        data : [
                            "Product Images are located in the position showed in the image.",
                            "Open download popup and select product images option to download.",
                        ],
                        svg: aliExpressProd
                    },
                    {
                        title: "Variation Images",
                        data : [
                            "Variation Images are located in the position showed in the image.",
                            "Some products donot contain variation images.",
                            "Open download popup and select Variation images option to download.",
                        ],
                        svg: aliExpressVar
                    },
                    {
                        title: "Description Images",
                        data : [
                            "Description Images are located in the position showed in the image.",
                            "Scroll to download of page to view desired description images.",
                            "Open/Reopen download popup and select Description images option to download.",
                        ],
                        svg: aliExpressDesc
                    }
                ]
            },
            "ebay.com" : {
                categories: [
                    {
                        title: "Product Images",
                        data : [
                            "Product Images are located in the position showed in the image.",
                            "Open download popup and select product images option to download.",
                            "For some products, product and variation images are downloaded together.",
                        ],
                        svg: ebayProd
                    }
                ]
            },
            "amazon.com" : {
                categories: [
                    {
                        title: "Product Images",
                        data : [
                            "Product Images are located in the position showed in the image.",
                            "Open download popup and select product images option to download.",
                        ],
                        svg: amazonProd
                    },
                    {
                        title: "Variation Images",
                        data : [
                            "Variation Images are located in the position showed in the image.",
                            "Some products donot contain variation images.",
                            "Open download popup and select Variation images option to download.",
                        ],
                        svg: amazonVar
                    },
                    {
                        title: "Description Images",
                        data : [
                            "Description Images are located in the position showed in the image.",
                            "Scroll to download of page to view desired description images.",
                            "Some products donot contain description images.",
                            "Open/Reopen download popup and select Description images option to download.",
                        ],
                        svg: amazonDesc
                    }
                ]
            }
        }


        renderModalCategory(modalElem, data[source_name]['categories'][index]);
    }

})()


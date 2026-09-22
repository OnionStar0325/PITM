KB.on('dom.ready', function () {
    function makepath(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() *
                charactersLength));
        }
        return result;
    }
    const path = makepath(10);

    function onPaste(e) {
        var activeElement = document.activeElement;
        if (activeElement) {
            var inputs = ['textarea'];
            if (inputs.indexOf(activeElement.tagName.toLowerCase()) !== -1) {

                function IntoTextArea(data) {
                    if (!data) return;
                    var position = activeElement.selectionStart;
                    var value = activeElement.value;
                    
                    activeElement.value = value.slice(0, position) + data + value.slice(position);
                    activeElement.selectionStart = activeElement.selectionEnd = position + data.length;
                    activeElement.focus();

                    try {
                        var evt = new Event('input', { bubbles: true });
                        activeElement.dispatchEvent(evt);
                    } catch (err) {}
                }

                function onFileLoaded(e) {
                    var link = '?controller=PasteController&action=upload&plugin=PITM';

                    var json = {
                        'data': e.target.result,
                        'path': path
                    };

                    // 1. Check if we are creating a new Wiki page first
                    if (isWikiCreate(activeElement))
                    {
                        var warningMsg = '> ⚠️ **[Warning]** 이미지를 첨부하려면 먼저 Wiki 페이지를 저장(생성)한 후, 편집기에서 이미지를 붙여넣어 주세요. (Please save the Wiki page first before pasting images.)\n';
                        IntoTextArea(warningMsg);
                        return;
                    }

                    var WikiId = getWikiId(activeElement);
                    var TaskId = getTaskId(activeElement);

                    if (WikiId)
                    {
                        json['wiki_id'] = WikiId;
                    }
                    else if (TaskId)
                    {
                        json['task_id'] = TaskId;
                    }

                    KB.http.postJson(link, json).success(IntoTextArea);
                }

                if (e.clipboardData && e.clipboardData.items) {
                    var items = e.clipboardData.items;
                    if (items) {
                        for (var i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf("image") !== -1) {
                                var blob = items[i].getAsFile();
                                var reader = new FileReader();
                                reader.onload = onFileLoaded;
                                reader.readAsDataURL(blob);
                            }
                        }
                    }
                } else {
                    setTimeout(checkInput, 100);
                }
            }
        }
    }

    function getForm(activeElement) {
        if (!activeElement) return null;
        if (activeElement.form) return activeElement.form;
        if (activeElement.closest) return activeElement.closest('form');
        var parent = activeElement.parentElement;
        while (parent) {
            if (parent.tagName && parent.tagName.toLowerCase() === 'form') return parent;
            parent = parent.parentElement;
        }
        return null;
    }

    function isWikiCreate(activeElement) {
        var form = getForm(activeElement);
        if (form) {
            var action = form.getAttribute('action') || '';
            var isWikiForm = action.indexOf('wiki') !== -1 || action.indexOf('Wiki') !== -1;
            
            // New wiki page form has project_id but does NOT have editions or order
            var hasProjectId = form.querySelector('input[name="project_id"]');
            var hasEditions = form.querySelector('input[name="editions"]');
            var idInput = form.querySelector('input[name="id"]');
            var hasNoValidId = !idInput || !idInput.value || parseInt(idInput.value, 10) <= 0;

            if (isWikiForm && (action.indexOf('action=save') !== -1 || action.indexOf('/save') !== -1 || (hasProjectId && !hasEditions && hasNoValidId))) {
                return true;
            }

            // Check modal header or form header
            var modalBox = form.closest ? (form.closest('#modal-box') || form.closest('#modal-content')) : null;
            if (modalBox) {
                var modalTitle = modalBox.querySelector('.page-header h2, h2');
                if (modalTitle) {
                    var titleText = modalTitle.innerText || modalTitle.textContent || '';
                    if (titleText.indexOf('New Wiki page') !== -1 || titleText.indexOf('새 Wiki') !== -1 || titleText.indexOf('New wiki') !== -1) {
                        return true;
                    }
                }
            }
        }

        // Direct page URL check
        if (window.location.href.match(/\/wiki\/project\/\d+\/create/i) || 
            (window.location.search.indexOf('WikiController') !== -1 && window.location.search.indexOf('action=create') !== -1)) {
            return true;
        }

        return false;
    }

    function getWikiId(activeElement) {
        // 1. If we are on create page/modal, there is NO wiki_id yet!
        if (isWikiCreate(activeElement)) {
            return null;
        }

        // 2. Check form enclosing the active textarea (most reliable source of truth)
        var form = getForm(activeElement);
        if (form) {
            var action = form.getAttribute('action') || '';
            var actionMatch = action.match(/[?&]wiki_id=(\d+)/i);
            if (actionMatch && parseInt(actionMatch[1], 10) > 0) {
                return actionMatch[1];
            }

            var idInput = form.querySelector('input[name="id"]');
            var editionsInput = form.querySelector('input[name="editions"]');
            if (idInput && editionsInput && idInput.value && parseInt(idInput.value, 10) > 0) {
                return idInput.value;
            }

            // If this form is a Wiki form (has project_id or wiki action) but has NO valid wiki_id,
            // DO NOT fallback to background URL (prevents using other wiki's ID)!
            var isWikiForm = action.indexOf('wiki') !== -1 || action.indexOf('Wiki') !== -1 || !!form.querySelector('input[name="project_id"]');
            if (isWikiForm) {
                return null;
            }
        }

        // 3. If inside a modal popup, NEVER fallback to background URL!
        var isInsideModal = activeElement && ((activeElement.closest && (activeElement.closest('#modal-box') || activeElement.closest('#modal-content'))) || (form && form.closest && (form.closest('#modal-box') || form.closest('#modal-content'))));
        if (isInsideModal) {
            return null;
        }

        // 4. Check URL query parameters on direct edit page (only when not in modal)
        var urlParamId = new URLSearchParams(window.location.search).get('wiki_id');
        if (urlParamId && parseInt(urlParamId, 10) > 0) {
            return urlParamId;
        }

        // 5. Check clean URL path patterns strictly
        var editMatch = window.location.href.match(/\/wiki\/edit\/(\d+)/i);
        if (editMatch && parseInt(editMatch[1], 10) > 0) {
            return editMatch[1];
        }

        var detailMatch = window.location.href.match(/\/wiki\/project\/\d+\/detail\/(\d+)/i);
        if (detailMatch && parseInt(detailMatch[1], 10) > 0) {
            return detailMatch[1];
        }

        return null;
    }

    function getTaskId(activeElement){
        // If current form is a Wiki form, do NOT return task_id!
        var form = getForm(activeElement);
        if (form) {
            var action = form.getAttribute('action') || '';
            if (action.indexOf('wiki') !== -1 || action.indexOf('Wiki') !== -1 || !!form.querySelector('input[name="project_id"]')) {
                return null;
            }
        }

        var urlParamId = new URLSearchParams(window.location.search).get('task_id');
        if (urlParamId && parseInt(urlParamId, 10) > 0){
            return urlParamId;
        }

        var urlHrefId = window.location.href.replace(/.*\/task\/(\d+)\/*\?*.*/ig, "$1");
        if (urlHrefId != window.location.href && parseInt(urlHrefId, 10) > 0){
            return urlHrefId;
        }

        var urlPostId;
        var forms = document.getElementsByTagName("form");
        for (var i = 0; i < forms.length; i++){
            if (forms[i].getAttribute("method") && 
                forms[i].getAttribute("method").toLowerCase() == "post" && 
                forms[i].getAttribute("action") && 
                forms[i].getAttribute("action").toLowerCase().indexOf("task_id=") >= 0){
                    var match = forms[i].getAttribute("action").match(/[?&]task_id=(\d+)/i);
                    if (match && parseInt(match[1], 10) > 0) {
                        urlPostId = match[1];
                        break;
                    }
            }
        }
        if (urlPostId){
            return urlPostId;
        }
        return null;
    }

    function Enlarge(e) {
        window.open(e.target.src);
    }

    KB.onClick('.enlargable', Enlarge, !0);
    window.addEventListener('paste', onPaste, !1);
});

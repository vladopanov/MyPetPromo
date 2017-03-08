function startApp() {
    const kinveyBaseUrl = "https://baas.kinvey.com/";
    const kinveyAppKey = "kid_Sy6eylFYg";
    const kinveyAppSecret = "7f36703a9e29474db533b0a96b4e4fbf";
    const kinveyAppAuthHeaders = {
        'Authorization': `Basic ${btoa(kinveyAppKey + ":" + kinveyAppSecret)}`
    };

    //localStorage.clear(); // Clear user auth data
    $.noty.defaults.timeout = 3000;
    showHideMenuLinks();
    // Bind the form submit actions
    $("#formLogin").submit(loginUser);
    $("#formRegister").submit(registerUser);
    $("form").submit(function(e) { e.preventDefault(); });

    // Bind the navigation menu links
    $("#linkExport").click(exportData);
    $("#linkLogout").click(logoutUser);

// Bind the form submit buttons
    $("#buttonLoginUser").click(loginUser);
    $("#buttonRegisterUser").click(registerUser);

// Attach AJAX "loading" event listener
    let loadingMsg;
    $(document).on({
        ajaxStart: function() { loadingMsg = noty({text: "Loading...", type: "alert"});},
        ajaxStop: function() { loadingMsg.close(); }
    });

    function showHideMenuLinks() {
        if (localStorage.getItem('authToken')) {
            // We have logged in user
            showRegisterView();

            $("#linkRegisterPretender").show();
            $("#linkExport").show();
            $("#linkLogout").show();
        } else {
            // No logged in user
            showLoginView();

            $("#linkRegisterPretender").hide();
            $("#linkExport").hide();
            $("#linkLogout").hide();
        }
    }

    function showView(viewName) {
        // Hide all views and show the selected view only
        $('main > section').hide();
        $('#' + viewName).show();
    }

    function showLoginView() {
        showView('viewLogin');
        $('#formLogin').trigger('reset');
    }

    function showRegisterView() {
        $('#formRegister').trigger('reset');
        showView('viewRegister');
    }

    function saveAuthInSession(userInfo) {
        let userAuth = userInfo._kmd.authtoken;
        localStorage.setItem("authToken", userAuth);
        let userId = userInfo._id;
        localStorage.setItem("userId", userId);
        let username = userInfo.username;
        localStorage.setItem("username", username);
    }

    function handleAjaxError(response) {
        let errorMsg = JSON.stringify(response);
        if (response.readyState === 0)
            errorMsg = "Cannot connect due to network error.";
        if (response.responseJSON &&
            response.responseJSON.description)
            errorMsg = response.responseJSON.description;
        noty({ text: errorMsg, type: "error" });
    }

    function loginUser() {
        let userData = {
            username: $("#formLogin input[name=username]").val(),
            password: $("#formLogin input[name=passwd]").val()
        };

        $.ajax({
            method: "POST",
            url: kinveyBaseUrl + "user/" + kinveyAppKey + "/login",
            headers: kinveyAppAuthHeaders,
            data: userData,
            success: loginSuccess,
            error: handleAjaxError
        });
        function loginSuccess(userInfo) {
            saveAuthInSession(userInfo);
            showHideMenuLinks();
            showView("viewRegister");
            noty({text: "Успешно влизане.", type: "success"});
        }
    }

    function logoutUser() {
        localStorage.clear();
        showHideMenuLinks();
        showView("viewLogin");
        noty({ text: "Успешно излизане.", type: "success" });
    }

    function registerUser() {
        let userData = {
            name: $("#formRegister input[name=name]").val(),
            email: $("#formRegister input[name=email]").val(),
            phone: $("#formRegister input[name=phone]").val()
        };

        $.ajax({
            method: "POST",
            url: kinveyBaseUrl + "appdata/" + kinveyAppKey + "/pretenders",
            headers: getKinveyUserAuthHeaders(),
            data: userData,
            success: registerSuccess,
            error: handleAjaxError
        });
        function registerSuccess(response) {
            uploadPhoto(response);
            showHideMenuLinks();
            showView("viewRegister");
            noty({text: "Успешна регистрация", type: "success"});
        }

        return false;
    }

    function uploadPhoto(pretender) {
        let file = $("#formRegister input[name=photo]")[0].files[0];
        let metaData = {
            "_filename": file.name,
            "size": file.size,
            "mimeType": file.type,
            "_public": true
        }
        upload(metaData);

        function upload(data) {
            let requestUrl = kinveyBaseUrl + "blob/" + kinveyAppKey;

            let requestHeaders = {
                'Authorization': `Kinvey ${localStorage.getItem("authToken")}`,
                'Content-Type': 'application/json',
                'X-Kinvey-Content-type': data.mimeType
            };

            $.ajax({
                method: "POST",
                url: requestUrl,
                headers: requestHeaders,
                data: JSON.stringify(data),
                success: uploadSuccess,
                error: handleAjaxError
            });

            function uploadSuccess(success) {
                let innerHeaders = success._requiredHeaders;
                innerHeaders['Content-Type'] = file.type;
                let uploadUrl = success._uploadURL;
                let url = uploadUrl.split("?")[0];
                createPhoto(url, pretender);

                $.ajax({
                    method: "PUT",
                    url: uploadUrl,
                    headers: innerHeaders,
                    processData: false,
                    data: file
                }).then(
                    function () {
                        noty({ text: "Успешно качена снимка", type: "success" });
                    }
                ).catch(
                    function () {
                        handleAjaxError();
                    }
                );
            }
        }

        return false;
    }

    function createPhoto(url, pretender) {
        pretender.photo = url;

        $.ajax({
            method: "PUT",
            url: kinveyBaseUrl + "appdata/" + kinveyAppKey + "/pretenders/" + pretender._id,
            headers: getKinveyUserAuthHeaders(),
            data: pretender,
            success: createPhotoSuccess,
            error: handleAjaxError
        });
        function createPhotoSuccess() {
            document.location.href = "mailto:" + pretender.email + "?subject=MyKi Pet снимка от Теленор&body=Линк към снимката: " + url;
        }
    }

    function exportData() {
        getMatch();

        function getMatch() {
            $.ajax({
                method: "GET",
                url: kinveyBaseUrl + "appdata/" + kinveyAppKey + "/pretenders",
                headers: getKinveyUserAuthHeaders(),
                success: getMatchSuccess,
                error: handleAjaxError
            });
            function getMatchSuccess(pretenders) {
                downloadCSV(pretenders);
            }
        }
    }

    function getKinveyUserAuthHeaders() {
        return {
            'Authorization': `Kinvey ${localStorage.getItem("authToken")}`
        };
    }

    function downloadCSV(pretenders) {
        var data, filename, link;
        var csv = convertArrayOfObjectsToCSV({
            data: pretenders
        });
        if (csv == null) return;

        filename = 'export.csv';

        if (!csv.match(/^data:text\/csv/i)) {
            csv = 'data:text/csv;charset=utf-8,' + csv;
        }
        data = encodeURI(csv);

        link = document.createElement('a');
        link.setAttribute('href', data);
        link.setAttribute('download', filename);
        var event = document.createEvent("MouseEvents");
        event.initMouseEvent(
                "click", true, false, window, 0, 0, 0, 0, 0
                , false, false, false, false, 0, null
        );
        link.dispatchEvent(event);
    }

    function convertArrayOfObjectsToCSV(args) {
        var result, ctr, keys, columnDelimiter, lineDelimiter, data;

        data = args.data || null;
        if (data == null || !data.length) {
            return null;
        }

        columnDelimiter = args.columnDelimiter || ',';
        lineDelimiter = args.lineDelimiter || '\n';

        keys = Object.keys(data[0]);

        result = "\uFEFF";
        result += keys.join(columnDelimiter);
        result += lineDelimiter;

        data.forEach(function (item) {
            ctr = 0;
            keys.forEach(function (key) {
                if (ctr > 0) result += columnDelimiter;

                result += item[key];
                ctr++;
            });
            result += lineDelimiter;
        });

        return result;
    }
}

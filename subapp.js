// OH-=================================================================
//  btn登録用DOMContentLoaded(1回だけ実行)
// OH-=================================================================
document.addEventListener("DOMContentLoaded", function () {
    var btnMenu = new Btn("btnMenu", new eventBtnMenu());
    var btnTheme = new Btn("btnTheme", new eventBtnTheme());
});
// OH-=================================================================
//  各btnのイベント登録("DOMContentLoaded"から呼び出す)
// OH-=================================================================
var Btn = /** @class */ (function () {
    function Btn(targetBtnID, targetBtnClass) {
        var _this = this;
        this._targetBtnID = targetBtnID;
        this._targetBtnClass = targetBtnClass;
        var targetBtnType = document.getElementById(this._targetBtnID);
        if (targetBtnType instanceof HTMLButtonElement) {
            this._targetBtn = targetBtnType;
            this._targetBtn.addEventListener("click", function () { return _this._targetBtnClass.onclick(); });
        }
        else {
            this._targetBtn = null;
            console.error("Button with ID ".concat(this._targetBtnID, " element not found or invalid type."));
        }
    }
    return Btn;
}());
// OH-=================================================================
//  BtnMenuのイベントの登録(BtnClassから呼び出す)
// OH-=================================================================
var eventBtnMenu = /** @class */ (function () {
    function eventBtnMenu() {
        this._sidebarID = "sidebar";
        var sidebarType = document.getElementById(this._sidebarID);
        if (sidebarType instanceof HTMLElement) {
            this._sidebar = sidebarType;
        }
        else {
            this._sidebar = null;
            console.error("".concat(this._sidebarID, " element not found or invalid type."));
        }
    }
    eventBtnMenu.prototype.onclick = function () {
        if (this._sidebar) {
            this._sidebar.classList.toggle("open");
        }
        else {
            console.error("".concat(this._sidebarID, " element not found."));
        }
    };
    return eventBtnMenu;
}());
// OH-=================================================================
//  btnThemeのイベントの登録(BtnClassから呼び出す)
// OH-=================================================================
var eventBtnTheme = /** @class */ (function () {
    function eventBtnTheme() {
        this._sectionThemeID = "sectionTheme";
        var sectionThemeType = document.getElementById(this._sectionThemeID);
        if (sectionThemeType instanceof HTMLElement) {
            this._sectionTheme = sectionThemeType;
        }
        else {
            this._sectionTheme = null;
            console.error("".concat(this._sectionThemeID, " element not found or invalid type."));
        }
    }
    eventBtnTheme.prototype.onclick = function () {
        if (this._sectionTheme) {
            var sections = document.querySelectorAll(".section");
            for (var _i = 0, _a = Array.from(sections); _i < _a.length; _i++) {
                var section = _a[_i];
                section.style.display = "none";
            }
            location.hash = "sectionTheme";
            this._sectionTheme.style.display = "block";
        }
        else {
            console.error("".concat(this._sectionThemeID, " element not found."));
        }
    };
    return eventBtnTheme;
}());

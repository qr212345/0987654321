var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// OH-=============================================================================================
//  btn登録用DOMContentLoaded(1回だけ実行)
// OH-=============================================================================================
document.addEventListener("DOMContentLoaded", function () {
    var btnMenu = new Btn("btnMenu", new eventBtnMenu());
    var btnTheme = new Btn("btnTheme", new eventBtnSectionTheme());
    var btnHelp = new Btn("btnHelp", new eventBtnSectionHelp());
    var btnWebQW = new Btn("btnWebQW", new eventBtnWebQW());
    var btnWebRankingusheet = new Btn("btnWebRankingusheet", new eventBtnWebRankingusheet());
    var btnSystemRanking = new Btn("btnSystemRanking", new eventBtnSectionSystemRanking());
});
var Massage = /** @class */ (function () {
    function Massage() {
    }
    Massage.displayMessage = function (msg, duration) {
        if (duration === void 0) { duration = 3000; }
        var area = document.getElementById("messageArea");
        if (area instanceof HTMLButtonElement) {
            area.textContent = msg;
            if (Massage._msgTimer !== null) {
                clearTimeout(Massage._msgTimer);
            }
            Massage._msgTimer = window.setTimeout(function () {
                area.textContent = "";
            }, duration);
        }
        else {
            console.error("Button with ID ".concat(area, " element not found or invalid type."));
        }
    };
    Massage._msgTimer = null;
    return Massage;
}());
// OH-=============================================================================================
//  各btnのイベント登録("DOMContentLoaded"から呼び出す)
// OH-=============================================================================================
var Btn = /** @class */ (function () {
    function Btn(targetBtnID, targetBtn___targetClass) {
        var _this = this;
        this._targetBtnID = targetBtnID;
        this.targetBtn___targetClass = targetBtn___targetClass;
        var targetBtnType = document.getElementById(this._targetBtnID);
        if (targetBtnType instanceof HTMLButtonElement) {
            this._targetBtn = targetBtnType;
            this._targetBtn.addEventListener("click", function () { return _this.targetBtn___targetClass.onclick(); });
        }
        else {
            this._targetBtn = null;
            console.error("Button with ID ".concat(this._targetBtnID, " element not found or invalid type."));
        }
    }
    return Btn;
}());
// OH-=============================================================================================
//  eventBtn~~~の親クラス
// OH-=============================================================================================
var eventBtn = /** @class */ (function () {
    function eventBtn() {
    }
    return eventBtn;
}());
// OH-=============================================================================================
//  classがsectionのHTMLElementをすべて消すためのクラス(eventBtnSection~~~から呼び出す)
// OH-=============================================================================================
var section = /** @class */ (function () {
    function section() {
    }
    section.Allclear_targetClass = function (_targetClass, _targetID) {
        var _sectionAllType = document.getElementsByClassName(_targetClass);
        if (_sectionAllType instanceof HTMLCollection) {
            var _sectionAll = _sectionAllType;
            if (_sectionAll) {
                for (var i = 0; i < _sectionAll.length; i++) {
                    var section_1 = _sectionAll[i];
                    if (section_1 instanceof HTMLElement) {
                        section_1.style.display = "none";
                    }
                }
            }
        }
        else {
            console.error("Elements with class ".concat(_targetClass, " not found or invalid type. From section.Allclear_targetClass"));
        }
    };
    return section;
}());
// OH-=============================================================================================
//  BtnMenuを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
var eventBtnMenu = /** @class */ (function (_super) {
    __extends(eventBtnMenu, _super);
    function eventBtnMenu() {
        var _this = _super.call(this) || this;
        _this._sidebarID = "sidebar";
        var sidebarType = document.getElementById(_this._sidebarID);
        if (sidebarType instanceof HTMLElement) {
            _this._sidebar = sidebarType;
        }
        else {
            _this._sidebar = null;
            console.error("".concat(_this._sidebarID, " element not found or invalid type."));
        }
        return _this;
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
}(eventBtn));
// OH-=============================================================================================
//  btnThemeを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
var eventBtnSectionTheme = /** @class */ (function (_super) {
    __extends(eventBtnSectionTheme, _super);
    function eventBtnSectionTheme() {
        var _this = _super.call(this) || this;
        _this._sectionThemeID = "sectionTheme";
        var sectionThemeType = document.getElementById(_this._sectionThemeID);
        if (sectionThemeType instanceof HTMLElement) {
            _this._sectionTheme = sectionThemeType;
        }
        else {
            _this._sectionTheme = null;
            console.error("".concat(_this._sectionThemeID, " element not found or invalid type."));
        }
        return _this;
    }
    eventBtnSectionTheme.prototype.onclick = function () {
        if (this._sectionTheme) {
            section.Allclear_targetClass("section", this._sectionThemeID);
            location.hash = "sectionTheme";
            this._sectionTheme.style.display = "block";
        }
        else {
            console.error("".concat(this._sectionThemeID, " element not found."));
        }
    };
    return eventBtnSectionTheme;
}(eventBtn));
// OH-=============================================================================================
//  btnHelpを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
var eventBtnSectionHelp = /** @class */ (function (_super) {
    __extends(eventBtnSectionHelp, _super);
    function eventBtnSectionHelp() {
        var _this = _super.call(this) || this;
        _this._sectionHelpID = "sectionHelp";
        var sectionHelpType = document.getElementById(_this._sectionHelpID);
        if (sectionHelpType instanceof HTMLElement) {
            _this._sectionHelp = sectionHelpType;
        }
        else {
            _this._sectionHelp = null;
            console.error("".concat(_this._sectionHelpID, " element not found or invalid type."));
        }
        return _this;
    }
    eventBtnSectionHelp.prototype.onclick = function () {
        if (this._sectionHelp) {
            section.Allclear_targetClass("section", this._sectionHelpID);
            location.hash = "sectionHelp";
            this._sectionHelp.style.display = "block";
        }
        else {
            console.error("".concat(this._sectionHelpID, " element not found."));
        }
    };
    return eventBtnSectionHelp;
}(eventBtn));
// OH-=============================================================================================
//  btnWebQWを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
var eventBtnWebQW = /** @class */ (function (_super) {
    __extends(eventBtnWebQW, _super);
    function eventBtnWebQW() {
        return _super.call(this) || this;
    }
    eventBtnWebQW.prototype.onclick = function () {
        window.location.assign("https://qr212345.github.io/QW/");
    };
    return eventBtnWebQW;
}(eventBtn));
// OH-=============================================================================================
//  btnWebRankingusheetを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
var eventBtnWebRankingusheet = /** @class */ (function (_super) {
    __extends(eventBtnWebRankingusheet, _super);
    function eventBtnWebRankingusheet() {
        return _super.call(this) || this;
    }
    eventBtnWebRankingusheet.prototype.onclick = function () {
        window.location.assign("https://qr212345.github.io/rankingusheet/");
    };
    return eventBtnWebRankingusheet;
}(eventBtn));
// OH-=============================================================================================
//  btnSystemRankingを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
var eventBtnSectionSystemRanking = /** @class */ (function (_super) {
    __extends(eventBtnSectionSystemRanking, _super);
    function eventBtnSectionSystemRanking() {
        var _this = _super.call(this) || this;
        _this._sectionSystemRankingID = "rankingSection";
        var sectionSystemRankingType = document.getElementById(_this._sectionSystemRankingID);
        if (sectionSystemRankingType instanceof HTMLElement) {
            _this._sectionSystemRanking = sectionSystemRankingType;
        }
        else {
            _this._sectionSystemRanking = null;
            console.error("".concat(_this._sectionSystemRankingID, " element not found or invalid type."));
        }
        return _this;
    }
    eventBtnSectionSystemRanking.prototype.onclick = function () {
        if (this._sectionSystemRanking) {
            section.Allclear_targetClass("section", this._sectionSystemRankingID);
            location.hash = "sectionSystemRanking";
            this._sectionSystemRanking.style.display = "block";
            var v = document.getElementById("rankingList");
            if (v) {
                v.innerHTML = "";
            }
        }
        else {
            console.error("".concat(this._sectionSystemRankingID, " element not found."));
        }
    };
    return eventBtnSectionSystemRanking;
}(eventBtn));

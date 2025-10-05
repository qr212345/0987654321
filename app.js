window.addEventListener("DOMContentLoaded", function () {
    addEvent();
    contentFixed();
    resizeUI();
});
window.addEventListener("scroll", function () {
    contentFixed();
});
window.addEventListener("resize", function () {
    contentFixed();
    resizeUI();
});
function addEvent() {
    var SIDE_BTN = document.getElementById("btnControl_sideMenu");
    var sideMenu = new fixed("sideMenu");
    if (!(SIDE_BTN instanceof HTMLButtonElement)) {
        return;
    }
    SIDE_BTN.addEventListener("click", function () {
        sideMenu.toggle();
    });
}
function contentFixed() {
    var heightDisplay = window.innerHeight;
    var sideMenu = new fixed("sideMenu");
    var sideBar = new fixed("sideBar");
    var nav = new fixed("nav");
    if (window.scrollY >= heightDisplay) {
        nav.fixed();
        sideBar.fixed();
    }
    else {
        nav.nofixed();
        sideMenu.nofixed();
        sideBar.nofixed();
    }
}
function resizeUI() {
    var heightDisplay = window.innerHeight;
    var header = document.getElementById("header");
    if (header instanceof HTMLElement) {
        header.style.height = heightDisplay + "px";
    }
}
var fixed = /** @class */ (function () {
    function fixed(targetID) {
        this._TARGET_ELEMENT = document.getElementById(targetID);
    }
    fixed.prototype.fixed = function () {
        if (this._TARGET_ELEMENT instanceof HTMLElement) {
            this._TARGET_ELEMENT.classList.add("fixed");
        }
    };
    fixed.prototype.nofixed = function () {
        if (this._TARGET_ELEMENT instanceof HTMLElement) {
            this._TARGET_ELEMENT.classList.remove("fixed");
        }
    };
    fixed.prototype.toggle = function () {
        if (this._TARGET_ELEMENT instanceof HTMLElement) {
            this._TARGET_ELEMENT.classList.toggle("fixed");
        }
    };
    return fixed;
}());

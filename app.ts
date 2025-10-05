window.addEventListener("DOMContentLoaded", () => {
    addEvent();
    contentFixed();
    resizeUI();
});

window.addEventListener("scroll", () => {
    contentFixed();
});

window.addEventListener("resize", () => {
    contentFixed();
    resizeUI();
});

function addEvent() {
    const SIDE_BTN = document.getElementById("btnControl_sideMenu");
    const sideMenu = new fixed("sideMenu");
    if (!(SIDE_BTN instanceof HTMLButtonElement)) {
        return;
    }
    SIDE_BTN.addEventListener("click", () => {
        sideMenu.toggle();
    });
}

function contentFixed() {
    const heightDisplay = window.innerHeight;
    const sideMenu = new fixed("sideMenu");
    const sideBar = new fixed("sideBar");
    const nav = new fixed("nav");
    if (window.scrollY >= heightDisplay) {
        nav.fixed();
        sideBar.fixed();
    } else {
        nav.nofixed();
        sideMenu.nofixed();
        sideBar.nofixed();
    }
}

function resizeUI() {
    const heightDisplay = window.innerHeight;
    const header = document.getElementById("header");
    if (header instanceof HTMLElement)  {
        header.style.height = heightDisplay + "px";
    }
}

class fixed {
    private _TARGET_ELEMENT: HTMLElement | null;

    constructor(targetID: string) {
        this._TARGET_ELEMENT = document.getElementById(targetID);
    }

    public fixed() {
        if (this._TARGET_ELEMENT instanceof HTMLElement) {
            this._TARGET_ELEMENT.classList.add("fixed");
        }
    }

    public nofixed() {
        if (this._TARGET_ELEMENT instanceof HTMLElement) {
            this._TARGET_ELEMENT.classList.remove("fixed");
        }
    }

    public toggle() {
        if (this._TARGET_ELEMENT instanceof HTMLElement) {
            this._TARGET_ELEMENT.classList.toggle("fixed");
        }
    }
}
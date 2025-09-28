// OH-=================================================================
//  btn登録用DOMContentLoaded(1回だけ実行)
// OH-=================================================================
document.addEventListener("DOMContentLoaded", () => {
    const btnMenu = new Btn("btnMenu", new eventBtnMenu());
    const btnTheme = new Btn("btnTheme", new eventBtnTheme());
});





// OH-=================================================================
//  各btnのイベント登録("DOMContentLoaded"から呼び出す)
// OH-=================================================================
class Btn {
    private _targetBtnID: string;
    private _targetBtn: HTMLButtonElement | null;
    private _targetBtnClass: { onclick: () => void };

    constructor(targetBtnID: string, targetBtnClass: { onclick: () => void }) {
        this._targetBtnID = targetBtnID;
        this._targetBtnClass = targetBtnClass;
        const targetBtnType = document.getElementById(this._targetBtnID);
        if (targetBtnType instanceof HTMLButtonElement) {
            this._targetBtn = targetBtnType;
            this._targetBtn.addEventListener("click", () => this._targetBtnClass.onclick());
        } else {
            this._targetBtn = null;
            console.error(`Button with ID ${this._targetBtnID} element not found or invalid type.`);
        }
    }
}





// OH-=================================================================
//  BtnMenuのイベントの登録(BtnClassから呼び出す)
// OH-=================================================================
class eventBtnMenu {
    private _sidebarID: string;
    private _sidebar: HTMLElement | null;

    constructor() {
        this._sidebarID = "sidebar";
        const sidebarType = document.getElementById(this._sidebarID);
        if (sidebarType instanceof HTMLElement) {
            this._sidebar = sidebarType;
        } else {
            this._sidebar = null;
            console.error(`${this._sidebarID} element not found or invalid type.`);
        }
    }

    public onclick() {
        if (this._sidebar) {
            this._sidebar.classList.toggle("open");
        } else {
            console.error(`${this._sidebarID} element not found.`);
        }
    }
}





// OH-=================================================================
//  btnThemeのイベントの登録(BtnClassから呼び出す)
// OH-=================================================================
class eventBtnTheme {
    private _sectionThemeID: string;
    private _sectionTheme: HTMLElement | null;

    constructor() {
        this._sectionThemeID = "sectionTheme";
        const sectionThemeType = document.getElementById(this._sectionThemeID);
        if (sectionThemeType instanceof HTMLElement) {
            this._sectionTheme = sectionThemeType;
        } else {
            this._sectionTheme = null;
            console.error(`${this._sectionThemeID} element not found or invalid type.`);
        }
    }

    public onclick() {
        if (this._sectionTheme) {
        const sections = document.querySelectorAll<HTMLElement>(".section");
        for (const section of Array.from(sections)) {
            section.style.display = "none";
        }
            location.hash="sectionTheme";
            this._sectionTheme.style.display = "block";
        } else {
            console.error(`${this._sectionThemeID} element not found.`);
        }
    }
}
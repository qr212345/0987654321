// OH-=============================================================================================
//  btn登録用DOMContentLoaded(1回だけ実行)
// OH-=============================================================================================
document.addEventListener("DOMContentLoaded", () => {
    const btnMenu = new Btn("btnMenu", new eventBtnMenu());
    const btnTheme = new Btn("btnTheme", new eventBtnSectionTheme());
    const btnHelp = new Btn("btnHelp", new eventBtnSectionHelp());
    const btnWebQW = new Btn("btnWebQW", new eventBtnWebQW());
    const btnWebRankingusheet = new Btn("btnWebRankingusheet", new eventBtnWebRankingusheet());
    const btnSystemRanking = new Btn("btnSystemRanking", new eventBtnSectionSystemRanking());
});





class Massage {
    static displayMessage(msg: string, duration: number = 3000, _msgTimer: number | null = null, area = document.getElementById("messageArea")) {
        if (area instanceof HTMLButtonElement) {
            area.textContent = msg;
            if (_msgTimer !== null) {
                clearTimeout(_msgTimer);
            }
            _msgTimer = window.setTimeout(() => {
                area.textContent = "";
            }, duration);
        } else {
            console.error(`Button with ID ${area} element not found or invalid type.`);
        }
    }
}



// OH-=============================================================================================
//  各btnのイベント登録("DOMContentLoaded"から呼び出す)
// OH-=============================================================================================
class Btn {
    private _targetBtnID: string;
    private _targetBtn: HTMLButtonElement | null;
    private targetBtn___targetClass: { onclick: () => void };

    constructor(targetBtnID: string, targetBtn___targetClass: { onclick: () => void }) {
        this._targetBtnID = targetBtnID;
        this.targetBtn___targetClass = targetBtn___targetClass;
        const targetBtnType = document.getElementById(this._targetBtnID);
        if (targetBtnType instanceof HTMLButtonElement) {
            this._targetBtn = targetBtnType;
            this._targetBtn.addEventListener("click", () => this.targetBtn___targetClass.onclick());
        } else {
            this._targetBtn = null;
            console.error(`Button with ID ${this._targetBtnID} element not found or invalid type.`);
        }
    }
}





// OH-=============================================================================================
//  eventBtn~~~の親クラス
// OH-=============================================================================================
abstract class eventBtn {
    constructor() {}
    abstract onclick(): void;
}





// OH-=============================================================================================
//  classがsectionのHTMLElementをすべて消すためのクラス(eventBtnSection~~~から呼び出す)
// OH-=============================================================================================
class section {
    public static Allclear_targetClass(_targetClass: string, _targetID: string) {
        const _sectionAllType: HTMLCollection | null = document.getElementsByClassName(_targetClass);
        if (_sectionAllType instanceof HTMLCollection)  {
            const _sectionAll: HTMLCollection | null = _sectionAllType;
            for (let i = 0; i < _sectionAll.length; i++) {
                const section = _sectionAll[i];
                if (section instanceof HTMLElement) {
                    section.style.display = "none";
                }
            }
        } else {
            console.error(`Elements with class ${_targetClass} not found or invalid type. From section.Allclear_targetClass`);
        }
    }
}





// OH-=============================================================================================
//  BtnMenuを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
class eventBtnMenu extends eventBtn {
    private _sidebarID: string;
    private _sidebar: HTMLElement | null;

    constructor() {
        super();
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





// OH-=============================================================================================
//  btnThemeを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
class eventBtnSectionTheme extends eventBtn {
    private _sectionThemeID: string;
    private _sectionTheme: HTMLElement | null;

    constructor() {
        super();
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
            section.Allclear_targetClass("section", this._sectionThemeID);
            location.hash="sectionTheme";
            this._sectionTheme.style.display = "block";
        } else {
            console.error(`${this._sectionThemeID} element not found.`);
        }
    }
}





// OH-=============================================================================================
//  btnHelpを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
class eventBtnSectionHelp extends eventBtn {
    private _sectionHelpID: string;
    private _sectionHelp: HTMLElement | null;

    constructor() {
        super();
        this._sectionHelpID = "sectionHelp";
        const sectionHelpType = document.getElementById(this._sectionHelpID);

        if (sectionHelpType instanceof HTMLElement) {
            this._sectionHelp = sectionHelpType;
        } else {
            this._sectionHelp = null;
            console.error(`${this._sectionHelpID} element not found or invalid type.`);
        }
    }

    public onclick() {
        if (this._sectionHelp) {
            section.Allclear_targetClass("section", this._sectionHelpID);
            location.hash="sectionHelp";
            this._sectionHelp.style.display = "block";
        } else {
            console.error(`${this._sectionHelpID} element not found.`);
        }
    }
}





// OH-=============================================================================================
//  btnWebQWを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
class eventBtnWebQW extends eventBtn {
    constructor() {
        super();
    }

    public onclick() {
        window.location.assign("https://qr212345.github.io/QW/");
    }
}





// OH-=============================================================================================
//  btnWebRankingusheetを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
class eventBtnWebRankingusheet extends eventBtn {
    constructor() {
        super();
    }

    public onclick() {
        window.location.assign("https://qr212345.github.io/rankingusheet/");
    }
}





// OH-=============================================================================================
//  btnSystemRankingを押したら起こるイベントの内容(BtnClassから呼び出す)
// OH-=============================================================================================
class eventBtnSectionSystemRanking extends eventBtn {
    private _sectionSystemRankingID: string;
    private _sectionSystemRanking: HTMLElement | null;

    constructor() {
        super();
        this._sectionSystemRankingID = "rankingSection";
        const sectionSystemRankingType = document.getElementById(this._sectionSystemRankingID);
        if (sectionSystemRankingType instanceof HTMLElement) {
            this._sectionSystemRanking = sectionSystemRankingType;
        } else {
            this._sectionSystemRanking = null;
            console.error(`${this._sectionSystemRankingID} element not found or invalid type.`);
        }
    }

    public onclick() {
        if (this._sectionSystemRanking) {
            section.Allclear_targetClass("section", this._sectionSystemRankingID);
            location.hash="sectionSystemRanking";
            this._sectionSystemRanking.style.display = "block";
            const v = document.getElementById("rankingList");
            if (v) {
                v.innerHTML = "";
            }
        } else {
            console.error(`${this._sectionSystemRankingID} element not found.`);
        }
    }
}
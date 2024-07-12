export default class BugReportFormWNG extends Application {

    constructor(app) {
        super(app)

        this.endpoint = "https://aa5qja71ih.execute-api.us-east-2.amazonaws.com/Prod/wng"

        this.domains = [
            "Wrath & Glory System",
            "Core Module",
            "Forsaken System Module",
            "Litanies of the Lost",
            "Redacted Records I",
            "Church of Steel",
        ]

        this.domainKeys = [
            "wrath-and-glory",
            "wng-core",
            "wng-forsaken",
            "wng-litanies",
            "wng-records1",
            "wng-cos",
        ]

        this.domainKeysToLabel = {
            "wrath-and-glory" : "system",
            "wng-core" : "core",
            "wng-forsaken" : "forsaken",
            "wng-litanies" : "litanies",
            "wng-records1" : "records1",
            "wng-cos" : "cos"
        }
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "bug-report";
        options.template = "systems/wrath-and-glory/template/apps/bug-report.hbs"
        options.classes.push("wrath-and-glory", "wng-bug-report");
        options.resizable = true;
        options.width = 600;
        options.minimizable = true;
        options.title = "W&G Bug Report"
        return options;
    }


    getData() {
        let data = super.getData();
        data.domains = this.domains;
        data.name = game.settings.get("wrath-and-glory", "bugReportName")
        return data;
    }

    submit(data) {
        fetch(this.endpoint, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: data.title,
                body: data.description,
                assignees: ["moo-man"],
                labels : data.labels
            })
        })
        .then(res => {
            if (res.status == 201)
            {
                ui.notifications.notify(game.i18n.localize("ImperialPost"))
                res.json().then(json => {
                    console.log("%c%s%c%s", 'color: #8a2e2a', `ADEPTUS ADMINISTRATUM:`, 'color: unset', ` Thank you for your submission. If you wish to monitor or follow up with additional details like screenshots, you can find your issue here: ${json.hbs_url}`)
                })
            }
            else 
            {
               ui.notifications.error(game.i18n.localize("ImperialPostError"))
               console.error(res)
            }   

        })
        .catch(err => {
            ui.notifications.error(game.i18n.localize("Something went wrong"))
            console.error(err)
        })
    }

    activateListeners(html) {

        html.find(".bug-submit").click(ev => {
            let data = {};
            let form = $(ev.currentTarget).parents(".bug-report")[0];
            data.domain = $(form).find(".domain")[0].value
            data.title = $(form).find(".bug-title")[0].value
            data.description = $(form).find(".bug-description")[0].value
            data.issuer = $(form).find(".issuer")[0].value
            let label = $(form).find(".issue-label")[0].value;

            if (!data.domain || !data.title || !data.description)
                return ui.notifications.error(game.i18n.localize("BugReport.ErrorForm"))
            if (!data.issuer)
                return ui.notifications.error(game.i18n.localize("BugReport.ErrorName1"))

            data.title = `[${this.domains[Number(data.domain)]}] ${data.title}`
            data.description = data.description + `<br/>**From**: ${data.issuer}`

            data.labels = [this.domainKeysToLabel[this.domainKeys[Number(data.domain)]]]

            if (label)
                data.labels.push(label);

            game.settings.set("wrath-and-glory", "bugReportName", data.issuer);

            let officialModules = Array.from(game.modules).filter(m => this.domainKeys.includes(m.id))
            
            let versions = `<br/>wrath-and-glory: ${game.system.version}`

            for (let mod of officialModules)
            {
                if (mod.active)
                    versions = versions.concat(`<br/>${mod.id}: ${mod.version}`)
            }

            data.description = data.description.concat(versions);
            data.description += `<br/>Active Modules: ${game.modules.contents.filter(i => i.active).map(i => i.id).filter(i => !this.domainKeys.includes(i)).join(", ")}`

            this.submit(data)
            this.close()
        })
    }
}
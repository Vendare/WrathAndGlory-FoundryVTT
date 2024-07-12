import WNGDocumentMixin from "./mixin.js";
import { WNGTest } from "../common/tests/test.js";
import WeaponTest from "../common/tests/weapon-test.js";
import PowerTest from "../common/tests/power-test.js";
import CorruptionTest from "../common/tests/corruption-test.js";
import MutationTest from "../common/tests/mutation-test.js";
import ResolveTest from "../common/tests/resolve-test.js";
import DeterminationRoll from "../common/tests/determination.js";
import AbilityRoll from "../common/tests/ability-roll.js";
import WNGUtility from "../common/utility.js";
import StealthRoll from "../common/tests/stealth.js";
import CharacterCreation from "../apps/character-creation.js";
import { RollDialog } from "../common/dialogs/base-dialog.js";
import { WeaponDialog } from "../common/dialogs/weapon-dialog.js";
import { PowerDialog } from "../common/dialogs/power-dialog.js";

export class WrathAndGloryActor extends WNGDocumentMixin(Actor) {

    prepareBaseData() {
        // this.propagateDataModels(this.system, "runScripts", this.runScripts.bind(this));
        this._itemTypes = null; 
        this.derivedEffects = []
        this.system.computeBase();
        // this.runScripts("prepareBaseData", this);
    }

    prepareDerivedData()
    {
        this.runScripts("prePrepareDerivedData", this);
        this.system.computeDerived();
        this.items.forEach(i => i.prepareOwnedData());
    }


    prepareDerivedData() {
        // this.runScripts("prePrepareDerivedData", this);
        this.system.computeDerived();
        this._applyDerivedEffects()
        this.items.forEach(i => i.prepareOwnedData());
        // this.runScripts("prepareOwnedItems", this);
        // this.system.computeDerived();
        // this.runScripts("postPrepareDerivedData", this);
    }

    _applyDerivedEffects() {
        this.derivedEffects.forEach(change => {
            change.effect.fillDerivedData(this, change)
            change.effect.apply(this, change);
        })
    }

    //#region Rolling
    async setupAttributeTest(attribute, options = {}) {
        let attributeObject = this.attributes[attribute]

        let dialogData = this._baseDialogData();
        dialogData.title = `${game.i18n.localize(attributeObject.label)} Test`
        dialogData.pool.size = attributeObject.total
        this._addOptions(dialogData, options)
        dialogData.type = "attribute"
        dialogData.attribute = attribute
        let testData = await RollDialog.create(dialogData)
        testData.targets = dialogData.targets
        testData.title = dialogData.title
        testData.speaker = this.speakerData();
        testData.attribute = attribute;
        return new WNGTest(testData)
    }

    async setupSkillTest(skill, options = {}) {
        let skillObject = this.skills[skill]

        let dialogData = this._baseDialogData();
        dialogData.title = `${game.i18n.localize(skillObject.label)} Test`
        dialogData.pool.size = skillObject.total
        this._addOptions(dialogData, options)
        dialogData.type = "skill"
        dialogData.skill = skill
        let testData = await RollDialog.create(dialogData)
        testData.targets = dialogData.targets
        testData.title = dialogData.title
        testData.speaker = this.speakerData();
        testData.skill = skill
        testData.attribute = skillObject.attribute
        return new WNGTest(testData)
    }

    async setupGenericTest(type, options = {}) {
        let dialogData = this._baseDialogData();
        let testClass = WNGTest
        switch (type) {
            case "stealth":
                dialogData.pool.size = this.skills.stealth.total;
                dialogData.title = game.i18n.localize(`ROLL.STEALTH`);
                dialogData.noDn = true;
                testClass = StealthRoll;
                break;
            case "determination":
                dialogData.pool.size = this.combat.determination.total
                dialogData.title = game.i18n.localize(`ROLL.DETERMINATION`)
                dialogData.determination = true;
                dialogData.noDn = true;
                testClass = DeterminationRoll;
                break;
            case "conviction":
                dialogData.pool.size = this.combat.conviction.total
                dialogData.title = game.i18n.localize(`ROLL.CONVICTION`)
                break;
            case "corruption":
                dialogData.pool.size = this.combat.conviction.total
                dialogData.title = game.i18n.localize(`ROLL.CORRUPTION`)
                this._addCorruptionData(dialogData)
                testClass = CorruptionTest;
                break;
            case "mutation":
                dialogData.pool.size = this.combat.conviction.total
                dialogData.title = game.i18n.localize(`ROLL.MUTATION`)
                dialogData.difficulty.target = 3
                testClass = MutationTest;
                break;
            case "fear":
                dialogData.pool.size = this.combat.resolve.total
                dialogData.title = game.i18n.localize(`ROLL.FEAR`)
                dialogData.type == "fear"
                testClass = ResolveTest
                break;
            case "terror":
                dialogData.pool.size = this.combat.resolve.total
                dialogData.title = game.i18n.localize(`ROLL.TERROR`)
                dialogData.type == "terror"
                testClass = ResolveTest
                break;
            case "influence":
                dialogData.pool.size = this.resources.influence
                dialogData.title = game.i18n.localize(`ROLL.INFLUENCE`)
                break;
            default:
                throw new Error("Unknown roll type: " + type)
        }
        this._addOptions(dialogData, options)
        dialogData.type = type
        let testData = await RollDialog.create(dialogData)
        testData.title = dialogData.title
        testData.speaker = this.speakerData();
        testData.type = type
        ui.sidebar.activateTab("chat")
        return new testClass(testData)
    }



    async setupWeaponTest(weapon, options={})
    {
        if (typeof weapon == "string")
            weapon = this.items.get(weapon) || await fromUuid(weapon)

        options.combi = weapon.system.combi.document ? await Dialog.confirm({title : "Combi-Weapons", content : "Fire both Combi-Weapons?"}) : false

        let tests = []
        let multi = options.combi ? 2 : 0;

        // If targets, call this function again with single target option
        if (game.user.targets.size)
        {
            let targets = Array.from(game.user.targets)
            game.user.updateTokenTargets([])
            options.multi = targets.length + multi;
            // Function needs to return an array of WeaponTests so need to do some funky stuff to convert
            targets.forEach(target => {
                options.target = target;
                tests.push(this._promptWeaponDialog(weapon, options))
                if (options.combi)
                {
                    tests.push(this._promptWeaponDialog(weapon.system.combi.document, options))
                }
            })
            tests = await Promise.all(tests)
        }
        else 
        {
            options.multi = multi;
            tests = [await this._promptWeaponDialog(weapon, options)];
            if (options.combi)
            {
                tests.push(await this._promptWeaponDialog(weapon.system.combi.document, options))
            }
        }


        return tests
    }

    async _promptWeaponDialog(weapon, options)
    {
        let dialogData = this._weaponDialogData(weapon, {multi : options.multi, targets : [options.target].filter(t => t)});
        dialogData.title = `${weapon.name} Test`
        this._addOptions(dialogData, options)
        dialogData.type = "weapon"
        dialogData.skill = weapon.isMelee ? "weaponSkill" : "ballisticSkill"
        dialogData.attribute = weapon.getSkillFor(this).attribute
        let testData = await WeaponDialog.create(dialogData)
        testData.targets = dialogData.targets
        testData.title = dialogData.title
        testData.speaker = this.speakerData();
        testData.itemId = weapon.uuid
        testData.skill = dialogData.skill
        testData.attribute = dialogData.attribute
        return new WeaponTest(testData);
    }

    async setupPowerTest(power, options = {}) {
        if (typeof power == "string")
            power = this.items.get(power) || await fromUuid(power)

        let dialogData = this._powerDialogData(power);
        dialogData.title = `${power.name}`
        this._addOptions(dialogData, options)
        dialogData.type = "power"
        dialogData.skill = "psychicMastery"
        dialogData.attribute = power.skill.attribute
        let testData = await PowerDialog.create(dialogData)
        testData.targets = dialogData.targets
        testData.title = dialogData.title
        testData.speaker = this.speakerData();
        testData.itemId = power.uuid
        testData.skill = dialogData.skill
        testData.attribute = dialogData.attribute
        ui.sidebar.activateTab("chat")
        return new PowerTest(testData)
    }

    async setupAbilityRoll(ability, options = {}) {
        let testData = {
            title: ability.name,
            speaker: this.speakerData(),
            itemId: ability.uuid,
            damage: {},
            ed: {},
            ap: {}
        }
        if (ability.hasDamage) {
            testData.damage.base = ability.damage.base
            testData.damage.bonus = ability.damage.bonus
            testData.damage.rank = ability.damage.rank
            testData.ed.base = ability.ed.base
            testData.ed.bonus = ability.ed.bonus
            testData.ed.rank = ability.ed.rank
            testData.ap.base = ability.ap.base
            testData.ap.bonus = ability.ap.bonus
            testData.ap.rank = ability.ap.rank
            testData.otherDamage = {
                mortalWounds: { value: ability.otherDamage.mortalWounds, bonus : 0 },
                wounds: { value: ability.otherDamage.wounds, bonus : 0 },
                shock: { value: ability.otherDamage.shock, bonus : 0 },
            }

        }
        ui.sidebar.activateTab("chat")
        return new AbilityRoll(testData)
    }

    _baseDialogData() {
        return {
            difficulty: {
                target: 3,
                penalty: 0,
                rank: "none"
            },
            pool: {
                size: 1,
                bonus: 0,
                rank: "none"
            },
            wrath: {
                base: this.hasCondition("dying") ? 1 + this.itemCategories["traumaticInjury"].length : 1
            },
            changes: this.allDialogChanges( {targets : Array.from(game.user.targets).map(t => t.actor)}),
            actor: this,
            targets: Array.from(game.user.targets)
        };
    }


    _weaponDialogData(weapon, options={}) {

        let dialogData = this._baseDialogData()
        if (options.targets)
        {
            dialogData.targets = options.targets;
            dialogData.changes = this.allDialogChanges({targets: options.targets.map(i => i.actor), vehicle : weapon.actor?.type == "vehicle" ? weapon.actor : null});
            // Weapon dialogs need to get dialog changes separately because of special target handling
        }

        if (weapon.Ammo) {
            // Add ammo dialog changes if any exist
            weapon.Ammo.effects.forEach(e => {
                mergeObject(dialogData.changes, e.getDialogChanges())
            })
        }
        dialogData.weapon = weapon
        dialogData.skill = weapon.getSkillFor(this)
        dialogData.pool.size = dialogData.skill.total;
        dialogData.pool.bonus = weapon.attack.base + weapon.attack.bonus;
        if (this.isMob)
            dialogData.pool.bonus += Math.ceil(this.mob / 2)
        dialogData.pool.rank = weapon.attack.rank;
        dialogData.damageValues = weapon.damageValues

        dialogData.damage = duplicate(weapon.system.damage)
        dialogData.ed = duplicate(weapon.system.damage.ed)
        dialogData.ap = duplicate(weapon.system.damage.ap)

        if (weapon.isMelee) {
            dialogData.damage.base += this.attributes.strength.total
        }

        if (weapon.traitList.force) {
            if (this.hasKeyword("PSYKER"))
                dialogData.damage.bonus += Math.ceil(this.attributes.willpower.total / 2)
            else
                dialogData.damage.bonus -= 2
        }

        if (dialogData.targets[0])
        {
            let target = dialogData.targets[0]
            let token
            dialogData.difficulty.target = target.actor.combat.defence.total

            if (this.isToken)
                token = this.token
            else
                token = this.getActiveTokens()[0]?.document

            if (token)
                dialogData.distance = canvas.grid.measureDistances([{ ray: new Ray({ x: token.x, y: token.y }, { x: target.x, y: target.y }) }], { gridSpaces: true })[0]

            if (target.actor.system.combat.size == "large")
            {
                dialogData.pool.bonus += 1;
            }
            else if (target.actor.system.combat.size == "huge")
            {
                dialogData.pool.bonus += 2;
            }
            else if (target.actor.system.combat.size == "gargantuan")
            {
                dialogData.pool.bonus += 3;
            }


        // If using melee and target has parry weapon equipped, increase difficulty
        if (weapon.system.category == "melee" && target.actor.itemTypes.weapon.find(i => i.equipped && i.traitList["parry"]))
        {
            dialogData.difficulty.penalty += 1;
        }

        }
        dialogData.difficulty.penalty += weapon.traitList.unwieldy ? weapon.traitList.unwieldy.rating : 0

        if (this.hasKeyword("ORK") && weapon.traitList["waaagh!"])
        {
            dialogData.pool.bonus += 1;
            if (this.combat.wounds.value > 0)
                dialogData.ed.bonus += 1
        }

        if (options.multi > 1)
        {
            dialogData.difficulty.penalty += (options.multi - 1) * 2;
            dialogData.multi = options.multi
        }

        return dialogData
    }

    _powerDialogData(power) {
        let dialogData = this._baseDialogData()
        dialogData.power = power
        dialogData.difficulty.target = power.system.DN
        if (!Number.isNumeric(dialogData.difficulty.target)) {
            ui.notifications.warn(game.i18n.localize("DIALOG.TARGET_DEFENSE_WARNING"))
        }
        dialogData.pool.size = power.skill.total;
        return dialogData
    }

    _addOptions(dialogData, options) {
        dialogData.difficulty.target = options.dn || dialogData.difficulty.target
        dialogData.pool.size = options.pool || dialogData.pool.size
        dialogData.title = options.title || dialogData.title
        delete options.title;
        delete options.pool;
        delete options.dn;

        mergeObject(dialogData, options);
    }

    _addCorruptionData(dialogData) {
        let level = game.wng.config.corruptionLevels[this.corruptionLevel]
        dialogData.difficulty.penalty += level.dn
    }

    speakerData() {
        if (this.isToken) {
            return {
                token: this.token.id,
                scene: this.token.parent.id
            }
        }
        else {
            return {
                actor: this.id
            }
        }
    }

    allDialogChanges({targets=[], vehicle} = {}) {
        let effects = this.effects.contents.concat(vehicle?.effects.contents || []);
        // Aggregate dialog changes from each effect
        let changes = effects.filter(e => !e.disabled).reduce((prev, current) => mergeObject(prev, current.getDialogChanges()), {})

        if (targets.length) {
            let target = targets[0]
            let targetChanges = target.effects.filter(e => !e.disabled).reduce((prev, current) => mergeObject(prev, current.getDialogChanges({target : true})), {})
            mergeObject(changes, targetChanges);
        }

        return changes
    }


    characterCreation(archetype) {
        new Dialog({
            title: "Character Creation",
            content: "<p>Begin Character Creation?</p>",
            yes: () =>  new CharacterCreation({ actor: this, archetype }).render(true),
            no: async () => {
                let species = await game.wng.utility.findItem(archetype.species.id, "species")
                let faction = await game.wng.utility.findItem(archetype.faction.id, "faction")
                this.createEmbeddedDocuments("Item", [archetype.toObject(), faction?.toObject(), species?.toObject()].filter(i => i))
               }
        }).render(true)
    }

    async applyArchetype(archetype, apply) {

        if (this.type == "agent" && apply) // If agent, start character creation
        {
            new CharacterCreation({ actor: this, archetype }).render(true)
        }
        else if (this.type == "threat" && apply) // If threat, apply archetype statistics
        {
            ui.notifications.notify(`Applying ${archetype.name} Archetype`)
            let actorData = this.toObject();

            let items = await archetype.GetArchetypeItems()
            items.push(archetype.toObject())
            let faction = items.find(i => i.type == "faction")
            let species = items.find(i => i.type == "species")
            faction.effects = [];
            actorData.system.combat.speed = species.system.speed;
            actorData.system.combat.size = species.system.size;


            for(let attr in archetype.attributes)
            {
                let attribute = actorData.system.attributes[attr]
                if (archetype.attributes[attr])
                    attribute.base = archetype.attributes[attr]

                if (archetype.suggested.attributes[attr] > attribute.base)
                    attribute.rating = archetype.suggested.attributes[attr] - attribute.base
            }

            for(let sk in archetype.skills)
            {
                let skill = actorData.system.skills[sk]
                if (archetype.skills[sk])
                    skill.base = archetype.skills[sk]

                if (archetype.suggested.skills[sk] > skill.base)
                    skill.rating = archetype.suggested.skills[sk] - skill.base
            }


            // Remove IDs so items work within the update method
            items.forEach(i => delete i._id)

            actorData.name = archetype.name;
            actorData.img = archetype.img;
            actorData.prototypeToken.texture.src = archetype.img.replace("images", "tokens").replace("actors", "tokens")

            await this.update(actorData)

            // Add items separately so active effects get added seamlessly
            this.createEmbeddedDocuments("Item", items)
        }
    }

    //#endregion

    get Size() {
        switch (this.combat.size) {
            case "tiny":
                return game.i18n.localize("SIZE.TINY");
            case "small":
                return game.i18n.localize("SIZE.SMALL");
            case "average":
                return game.i18n.localize("SIZE.AVERAGE");
            case "large":
                return game.i18n.localize("SIZE.LARGE");
            case "huge":
                return game.i18n.localize("SIZE.HUGE");
            case "gargantuan":
                return game.i18n.localize("SIZE.GARGANTUAN");
            default:
                return game.i18n.localize("SIZE.AVERAGE");
        }
    }

    get corruptionLevel() {
        let levels = Object.values(game.wng.config.corruptionLevels)
        return levels.findIndex(i => this.corruption.current >= i.range[0] && this.corruption.current <= i.range[1])
    }

    get isMob() {
        return this.type == "threat" && this.mob > 1
    }

    async addCondition(effect, flags = {}) {
        if (typeof (effect) === "string")
            effect = duplicate(CONFIG.statusEffects.concat(Object.values(game.wng.config.systemEffects)).find(e => e.id == effect))
        if (!effect)
            return "No Effect Found"

        if (!effect.id)
            return "Conditions require an id field"

        if (!effect.flags)
            effect.flags = flags
        else
            mergeObject(effect.flags, flags);

        let existing = this.hasCondition(effect.id)

        if (effect.id == "dying")
            await this.addCondition("prone")

        if (!existing) {
            effect.name = game.i18n.localize(effect.name)
            effect.statuses = [effect.id];
            delete effect.id
            return this.createEmbeddedDocuments("ActiveEffect", [effect])
        }
    }

    async removeCondition(effect, value = 1) {
        if (typeof (effect) === "string")
            effect = duplicate(CONFIG.statusEffects.concat(Object.values(game.wng.config.systemEffects)).find(e => e.id == effect))
        if (!effect)
            return "No Effect Found"

        if (!effect.id)
            return "Conditions require an id field"

        let existing = this.hasCondition(effect.id)

        if (existing) {
            return existing.delete()
        }
    }

    get archetype() { return this.itemTypes.archetype[0] }
    get species() { return this.itemTypes.species[0] }
    get faction() { return this.itemTypes.faction[0] }

    hasCondition(conditionKey) {
        let existing = this.effects.find(e => e.statuses.has(conditionKey))
        return existing
    }


    hasKeyword(keyword) {
        return !!this.itemTypes.keyword.find(i => i.name == keyword)
    }


    get attributes() { return this.system.attributes }
    get skills() { return this.system.skills }
    get combat() { return this.system.combat }
    get bio() { return this.system.bio }
    get advances() { return this.system.advances }
    get experience() { return this.system.experience }
    get resources() { return this.system.resources }
    get corruption() { return this.system.corruption }
    get notes() { return this.system.notes }
    get mob() { return this.system.mob }

    get traitsAvailable() {
        if (this.type == "vehicle")
            return game.wng.config.vehicleTraits
    }

    _itemTypes = null;

    get itemTypes()
    {
      if (!this._itemTypes)
      {
        this._itemTypes = super.itemTypes;
      }
      return this._itemTypes
    }
  

    getAttributeCosts(rating) {
        switch (rating) {
            case 1:
                return 0;
            case 2:
                return 4;
            case 3:
                return 10;
            case 4:
                return 20;
            case 5:
                return 35;
            case 6:
                return 55;
            case 7:
                return 80;
            case 8:
                return 110;
            case 9:
                return 145;
            case 10:
                return 185;
            case 11:
                return 230;
            case 12:
                return 280;
            default:
                return 0;
        }
    }

    getSkillsCosts(rating) {
        switch (rating) {
            case 1:
                return 2;
            case 2:
                return 6;
            case 3:
                return 12;
            case 4:
                return 20;
            case 5:
                return 30;
            case 6:
                return 42;
            case 7:
                return 56;
            case 8:
                return 72;
            default:
                return 0;
        }
    }


    /**
* Transform the Document data to be stored in a Compendium pack.
* Remove any features of the data which are world-specific.
* This function is asynchronous in case any complex operations are required prior to exporting.
* @param {CompendiumCollection} [pack]   A specific pack being exported to
* @return {object}                       A data object of cleaned data suitable for compendium import
* @memberof ClientDocumentMixin#
* @override - Retain ID
*/
    toCompendium(pack) {
        let data = super.toCompendium(pack)
        data._id = this.id; // Replace deleted ID so it is preserved
        return data;
    }

}

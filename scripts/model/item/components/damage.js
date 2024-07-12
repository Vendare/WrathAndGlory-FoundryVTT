let fields = foundry.data.fields;

export class DamageModel extends foundry.abstract.DataModel
{

    static defineSchema() 
    {
        let schema = {};
        schema.base = new fields.NumberField({initial: 0, nullable: false});
        schema.bonus = new fields.NumberField({initial: 0, nullable: false});
        schema.dice = new fields.NumberField({min: 0, initial: 0, nullable: false});
        schema.rank = new fields.StringField({initial : "none"});

        schema.ed = new fields.SchemaField({
            base: new fields.NumberField({initial: 0, nullable: false}),
            bonus: new fields.NumberField({initial: 0, nullable: false}),
            dice : new fields.NumberField({min: 0, initial: 0, nullable: false}),
            rank: new fields.StringField({initial : "none"})
        })
        
        schema.ap = new fields.SchemaField({
            base: new fields.NumberField({initial: 0, nullable: false}),
            bonus: new fields.NumberField({initial: 0, nullable: false}),
            dice : new fields.NumberField({min: 0, initial: 0, nullable: false}),
            rank: new fields.StringField({initial : "none"})
        })
        
        schema.otherDamage = new fields.SchemaField({
            mortalWounds : new fields.StringField({}),
            wounds : new fields.StringField({}),
            shock : new fields.StringField({})
        })
        return schema;
    }

    get formatted() {
        let damage = Number(this._dataWithRank("damage"));
        if (this.parent.isMelee && this.parent.parent.isOwned)
            damage += this.parent.parent.actor?.system.attributes?.strength?.total || 0
        return damage
    }
    get ED() {
        return this._dataWithRank("ed");
    }
    get AP() {
        return this._dataWithRank("ap");
    }

    
    _dataWithRank(type) {
        let data = type != "damage" ? this[type] : this;
        let damage = data.base + data.bonus;
        if (data.dice)
        {
            damage = damage ? damage + ` + ${data.dice}` : data.dice
        }
        let rank = "";
        if (data.rank === "single") {
            rank = " + R";
        } else if (data.rank === "double") {
            rank = " + DR";
        }
        return `${damage}${rank}`;
    }
}
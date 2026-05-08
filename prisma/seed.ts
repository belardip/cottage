import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  // Settings singleton
  const existing = await db.setting.count()
  if (!existing) {
    await db.setting.create({ data: { scheduleLocked: false, skippedSlots: '[]' } })
  }

  // People
  const peopleCount = await db.person.count()
  if (!peopleCount) {
    await db.person.createMany({
      data: [
        { name: 'Sean', coupleId: 1 },
        { name: 'Jackie', coupleId: 1 },
        { name: 'Marcus', coupleId: 2 },
        { name: 'Katelyn', coupleId: 2 },
        { name: 'Paul', coupleId: null },
        { name: 'Klara', coupleId: 3 },
        { name: 'Chris', coupleId: 3 },
      ],
    })
    console.log('✓ Seeded people')
  }

  // Default store
  const bfhExists = await db.store.findFirst({ where: { name: 'Bring from Home' } })
  if (!bfhExists) {
    await db.store.create({ data: { name: 'Bring from Home', sortOrder: 999 } })
    console.log('✓ Seeded default store')
  }

  // Staple suggestions
  const stapleCount = await db.stapleSuggestion.count()
  if (!stapleCount) {
    await db.stapleSuggestion.createMany({
      data: [
        { name: 'Instant Pot / pressure cooker', category: 'Cookware' },
        { name: 'Cast iron skillet', category: 'Cookware' },
        { name: 'Large stock pot', category: 'Cookware' },
        { name: 'Non-stick frying pan', category: 'Cookware' },
        { name: 'Saucepan (medium)', category: 'Cookware' },
        { name: 'Roasting pan', category: 'Cookware' },
        { name: 'Sheet pans (2)', category: 'Cookware' },
        { name: 'Dutch oven', category: 'Cookware' },
        { name: 'Grill pan', category: 'Cookware' },
        { name: "Chef's knife", category: 'Utensils' },
        { name: 'Cutting board (large)', category: 'Utensils' },
        { name: 'Tongs', category: 'Utensils' },
        { name: 'Spatula', category: 'Utensils' },
        { name: 'Ladle', category: 'Utensils' },
        { name: 'Wooden spoon', category: 'Utensils' },
        { name: 'Whisk', category: 'Utensils' },
        { name: 'Peeler', category: 'Utensils' },
        { name: 'Colander', category: 'Utensils' },
        { name: 'Measuring cups', category: 'Utensils' },
        { name: 'Measuring spoons', category: 'Utensils' },
        { name: 'Can opener', category: 'Utensils' },
        { name: 'Corkscrew / bottle opener', category: 'Utensils' },
        { name: 'Cheese grater', category: 'Utensils' },
        { name: 'Mixing bowls', category: 'Utensils' },
        { name: 'Blender', category: 'Appliances' },
        { name: 'Coffee maker', category: 'Appliances' },
        { name: 'Coffee grinder', category: 'Appliances' },
        { name: 'Toaster', category: 'Appliances' },
        { name: 'Electric kettle', category: 'Appliances' },
        { name: 'SodaStream', category: 'Appliances' },
        { name: 'Instant Pot / pressure cooker', category: 'Appliances' },
        { name: 'Air fryer', category: 'Appliances' },
        { name: 'Rice cooker', category: 'Appliances' },
        { name: 'Waffle maker', category: 'Appliances' },
        { name: 'Hand mixer', category: 'Appliances' },
        { name: 'Dish soap', category: 'Cleaning' },
        { name: 'Dish sponge', category: 'Cleaning' },
        { name: 'Dish towels', category: 'Cleaning' },
        { name: 'Paper towels', category: 'Cleaning' },
        { name: 'Garbage bags (large)', category: 'Cleaning' },
        { name: 'Garbage bags (small)', category: 'Cleaning' },
        { name: 'All-purpose spray cleaner', category: 'Cleaning' },
        { name: 'Dishwasher pods', category: 'Cleaning' },
        { name: 'Hand soap', category: 'Cleaning' },
        { name: 'Olive oil', category: 'Pantry Basics' },
        { name: 'Salt', category: 'Pantry Basics' },
        { name: 'Black pepper', category: 'Pantry Basics' },
        { name: 'Butter', category: 'Pantry Basics' },
        { name: 'Garlic', category: 'Pantry Basics' },
        { name: 'Onions', category: 'Pantry Basics' },
        { name: 'Eggs', category: 'Pantry Basics' },
        { name: 'Coffee', category: 'Pantry Basics' },
        { name: 'Sugar', category: 'Pantry Basics' },
        { name: 'Flour', category: 'Pantry Basics' },
        { name: 'Baking soda', category: 'Pantry Basics' },
        { name: 'Aluminum foil', category: 'Storage & Wrapping' },
        { name: 'Plastic wrap', category: 'Storage & Wrapping' },
        { name: 'Parchment paper', category: 'Storage & Wrapping' },
        { name: 'Ziplock bags (gallon)', category: 'Storage & Wrapping' },
        { name: 'Ziplock bags (quart)', category: 'Storage & Wrapping' },
        { name: 'Food storage containers', category: 'Storage & Wrapping' },
        { name: 'Matches / lighter', category: 'Misc' },
        { name: 'Napkins', category: 'Misc' },
        { name: 'Paper plates', category: 'Misc' },
        { name: 'Plastic cups', category: 'Misc' },
        { name: 'Serving platters', category: 'Misc' },
        { name: 'Salad bowl', category: 'Misc' },
        { name: 'Ice cube trays', category: 'Misc' },
        { name: 'Cooler / ice chest', category: 'Misc' },
        { name: 'Charcoal / lighter fluid', category: 'Misc' },
        { name: 'BBQ grill brush', category: 'Misc' },
      ],
    })
    console.log('✓ Seeded staple suggestions')
  } else {
    // Add any new suggestions that may not exist yet
    const newItems = [
      { name: 'Coffee grinder', category: 'Appliances' },
      { name: 'SodaStream', category: 'Appliances' },
      { name: 'Instant Pot / pressure cooker', category: 'Appliances' },
      { name: 'Air fryer', category: 'Appliances' },
      { name: 'Rice cooker', category: 'Appliances' },
      { name: 'Waffle maker', category: 'Appliances' },
      { name: 'Hand mixer', category: 'Appliances' },
    ]
    for (const item of newItems) {
      const exists = await db.stapleSuggestion.findFirst({ where: { name: item.name } })
      if (!exists) {
        await db.stapleSuggestion.create({ data: item })
        console.log(`✓ Added new suggestion: ${item.name}`)
      }
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())

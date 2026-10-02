import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const applications=sqliteTable('professional_applications',{
 id:text('id').primaryKey(), name:text('name').notNull(), phone:text('phone').notNull(), email:text('email'), city:text('city').notNull(), skill:text('skill').notNull(), experience:text('experience').notNull(), about:text('about').notNull(), consentVersion:text('consent_version').notNull(), createdAt:integer('created_at').notNull()
});

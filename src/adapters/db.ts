import SQL from 'sql-template-strings'
import { AppComponents } from '../types'

export type IDatabaseComponent = {
  getCommunityMembers: (
    communityId: string,
    options?: {
      include?: string[]
      exclude?: string[]
    }
  ) => Promise<string[]>
}

export async function createDBComponent(components: Pick<AppComponents, 'pg'>): Promise<IDatabaseComponent> {
  const { pg } = components

  const getCommunityMembers = async (
    communityId: string,
    options?: {
      include?: string[]
      exclude?: string[]
    }
  ) => {
    const includeAddresses = options?.include?.map((address) => `'${address.toLowerCase()}'`)
    const excludeAddresses = options?.exclude?.map((address) => `'${address.toLowerCase()}'`)

    const query = SQL`
      SELECT LOWER(cm.member_address) as address FROM communities c
      LEFT JOIN community_members cm ON cm.community_id = c.id
      LEFT JOIN community_bans cb ON cm.member_address = cb.banned_address 
      WHERE c.id = ${communityId} AND c.active = TRUE AND cb.banned_address IS NULL`

    if (includeAddresses) {
      query.append(` AND cm.member_address IN (${includeAddresses.join(',')})`)
    }

    if (excludeAddresses) {
      query.append(` AND cm.member_address NOT IN (${excludeAddresses.join(',')})`)
    }

    const result = await pg.query(query)
    return result.rows.map((row) => row.address)
  }

  return { getCommunityMembers }
}

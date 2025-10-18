/**
 * @swagger
 * components:
 *   schemas:
 *     Space:
 *       type: object
 *       required:
 *         - space_id
 *         - name
 *         - unit_number
 *         - street
 *         - address_subunit
 *         - city
 *         - region
 *         - country
 *         - postal_code
 *         - user_id
 *         - created_at
 *         - updated_at
 *       properties:
 *         space_id:
 *           type: integer
 *           format: int64
 *           description: Unique identifier for the space.
 *         name:
 *           type: string
 *           description: Display name of the space.
 *         unit_number:
 *           type: string
 *           description: Unit or suite number for the space.
 *         street:
 *           type: string
 *           description: Street information for the space address.
 *         address_subunit:
 *           type: string
 *           description: Additional address details such as building or floor.
 *         city:
 *           type: string
 *           description: City where the space is located.
 *         region:
 *           type: string
 *           description: Region, province, or state where the space is located.
 *         country:
 *           type: string
 *           description: Country where the space is located.
 *         postal_code:
 *           type: string
 *           description: Postal or ZIP code for the space address.
 *         user_id:
 *           type: integer
 *           format: int64
 *           description: Identifier of the user that owns the space.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the space record was created.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the space record was last updated.
 *     SpaceListResponse:
 *       type: object
 *       required:
 *         - data
 *         - nextCursor
 *       properties:
 *         data:
 *           type: array
 *           description: Page of spaces matching the supplied filters.
 *           items:
 *             $ref: '#/components/schemas/Space'
 *         nextCursor:
 *           type: string
 *           nullable: true
 *           description: Cursor to fetch the next page or null when there are no additional results.
 *     CreateSpaceRequest:
 *       type: object
 *       required:
 *         - name
 *         - unit_number
 *         - street
 *         - address_subunit
 *         - city
 *         - region
 *         - country
 *         - postal_code
 *         - user_id
 *       properties:
 *         name:
 *           type: string
 *         unit_number:
 *           type: string
 *         street:
 *           type: string
 *         address_subunit:
 *           type: string
 *         city:
 *           type: string
 *         region:
 *           type: string
 *         country:
 *           type: string
 *         postal_code:
 *           type: string
 *         user_id:
 *           type: integer
 *           format: int64
 *     CreateSpaceResponse:
 *       type: object
 *       required:
 *         - test
 *       properties:
 *         test:
 *           type: string
 *           description: Placeholder response while the endpoint is under development.
 *   parameters:
 *     SpaceLimitParam:
 *       in: query
 *       name: limit
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *         default: 20
 *       description: Maximum number of spaces to return per page.
 *     SpaceCursorParam:
 *       in: query
 *       name: cursor
 *       schema:
 *         type: string
 *       description: Cursor corresponding to the last received space_id to paginate forward.
 *     SpaceCityParam:
 *       in: query
 *       name: city
 *       schema:
 *         type: string
 *       description: Filter spaces by their city.
 *     SpaceRegionParam:
 *       in: query
 *       name: region
 *       schema:
 *         type: string
 *       description: Filter spaces by their region.
 *     SpaceSearchParam:
 *       in: query
 *       name: q
 *       schema:
 *         type: string
 *       description: Case-insensitive substring search for space names.
 */

// Export an empty object so the file is treated as a module.
export {};

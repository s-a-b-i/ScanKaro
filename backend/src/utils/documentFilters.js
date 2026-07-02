/** Base filter excluding soft-deleted documents for a user. */
export function activeDocumentsFilter(userId) {
  return {
    userId,
    isDeleted: false,
  };
}

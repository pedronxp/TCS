'use strict';

function sameOrganization(...organizationIds) {
  if (organizationIds.length < 2 || organizationIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    return false;
  }
  return organizationIds.every((id) => id === organizationIds[0]);
}

module.exports = { sameOrganization };

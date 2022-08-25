const exception = (status, title, detail='') =>
  ({ status, title, detail });

export const ExpiredException = detail =>
  exception(410, 'Gone', detail);

export const UnauthorizedException = detail =>
  exception(401, 'Unauthorized', detail);

export const BadRequestException = detail =>
  exception(400, 'Bad Request', detail);

export const BasicAuthHeaders = {
  'WWW-Authenticate': 'Basic realm="Authenticate in the format [firstname]:[passphrase]"',
};

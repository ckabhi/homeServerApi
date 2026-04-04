import { HttpException, HttpStatus } from '@nestjs/common';

export class FileNotFoundError extends HttpException {
  constructor(message: string = 'File not found') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class FolderNotFoundError extends HttpException {
  constructor(message: string = 'Folder not found') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class UnauthorizedAccessError extends HttpException {
  constructor(message: string = 'Unauthorized access to resource') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class FolderAlreadyExistsError extends HttpException {
  constructor(message: string = 'Folder already exists') {
    super(message, HttpStatus.CONFLICT);
  }
}

export class MinIOConnectionError extends HttpException {
  constructor(message: string = 'Storage service connection error') {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class InvalidFolderPathError extends HttpException {
  constructor(message: string = 'Invalid folder path') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

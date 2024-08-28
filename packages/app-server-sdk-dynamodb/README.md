# DynamoDB storage for the App Server SDK

This package provides a DynamoDB storage implementation for the App Server SDK.

## Installation

```bash
npm install @shopware-ag/app-server-sdk-dynamodb --save
```

## Usage

```javascript

import { DynamoDBRepository } from '@shopware-ag/app-server-sdk-dynamodb';

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"

const client = new DynamoDBClient();

const repository = new DynamoDBRepository(client, '<table-name>');

// Pass the repository to the AppServerSdk using constructor of AppServer or configureAppserver with Hono
```

## Table configuration

The table should have the following schema:

- `id` (String): The primary key of the table

primeryIndex: hashKey: id

or as SST config:

```js
const table = new sst.aws.Dynamo("shop", {
      fields: {
        id: "string"
      },
      primaryIndex: { hashKey: "id" }
});
```
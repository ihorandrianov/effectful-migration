export const BATCH_SIZE = 10;
export const CHECKPOINT_FILE = "./checkpoint.json";
export const SAVE_EVERY_NTH = 1;
export const ERROR_MSG_SAVE_FAIL = "Failed saving checkpoint:";
export const NOTION_WRITE_CONCURENCY = 2;
export const NOTION_DATABASE_PROPERTIES = {
  Name: {
    title: {},
  },
  Company: {
    rich_text: {},
  },
  Email: {
    email: {},
  },
  Phone: {
    phone_number: {},
  },
  Status: {
    select: {},
  },
  LeadSource: {
    select: {},
  },
  AnnualRevenue: {
    number: {},
  },
  NumberOfEmployees: {
    number: {},
  },
  CreatedDate: {
    date: {},
  },
  LastModifiedDate: {
    date: {},
  },
};

export const NOTION_DATABASE_TITLE = "Leads";

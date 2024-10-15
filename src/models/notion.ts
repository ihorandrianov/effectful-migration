export interface NotionLeadPage {
  parent: Parent;
  properties: NotionLeadProperties;
}

export interface Parent {
  database_id: string; // ID of the Notion database where the lead will be stored
}

export interface NotionLeadProperties {
  Name: TitleProperty;
  Company: RichTextProperty;
  Email: EmailProperty;
  Phone: PhoneProperty;
  Status: SelectProperty;
  LeadSource: SelectProperty;
  AnnualRevenue?: NumberProperty;
  NumberOfEmployees?: NumberProperty;
  CreatedDate: DateProperty;
  LastModifiedDate: DateProperty;
}

export interface TitleProperty {
  title: [
    {
      text: {
        content: string;
      };
    },
  ];
}

export interface RichTextProperty {
  rich_text: [
    {
      text: {
        content: string;
      };
    },
  ];
}

export interface EmailProperty {
  email: string;
}

export interface PhoneProperty {
  phone_number: string;
}

export interface SelectProperty {
  select: {
    name: string;
  };
}

export interface NumberProperty {
  number: number;
}

export interface DateProperty {
  date: {
    start: string;
  };
}

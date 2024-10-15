import { Lead } from "../models/salesforce";
import { NotionLeadPage } from "../models/notion";

export const createTransformFunction = (databaseId: string) => {
  return (lead: Lead): NotionLeadPage => ({
    parent: {
      database_id: databaseId,
    },
    properties: {
      Name: {
        title: [
          {
            text: {
              content: lead.Name,
            },
          },
        ],
      },
      Company: {
        rich_text: [
          {
            text: {
              content: lead.Company || "",
            },
          },
        ],
      },
      Email: {
        email: lead.Email,
      },
      Phone: {
        phone_number: lead.Phone || "",
      },
      Status: {
        select: {
          name: lead.Status,
        },
      },
      LeadSource: {
        select: {
          name: lead.LeadSource,
        },
      },
      AnnualRevenue: lead.AnnualRevenue
        ? { number: lead.AnnualRevenue }
        : undefined,
      NumberOfEmployees: lead.NumberOfEmployees
        ? { number: lead.NumberOfEmployees }
        : undefined,
      CreatedDate: {
        date: {
          start: new Date(lead.CreatedDate).toISOString(),
        },
      },
      LastModifiedDate: {
        date: {
          start: new Date(lead.LastModifiedDate).toISOString(),
        },
      },
    },
  });
};

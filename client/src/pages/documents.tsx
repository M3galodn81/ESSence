import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDocumentSchema } from "@shared/schema";
import { z } from "zod";
import { Folder, Upload, File, Download, Trash2, Eye, Plus } from "lucide-react";
import type { Document } from "@shared/schema";

const documentFormSchema = insertDocumentSchema.extend({
  file: z.any().optional(),
}).omit({ userId: true, fileName: true, filePath: true, fileSize: true });

type DocumentForm = z.infer<typeof documentFormSchema>;

export default function Documents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["/api/documents"],
  });

  const form = useForm<DocumentForm>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      name: "",
      type: "certificate",
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: DocumentForm) => {
      
      const mockDocument = {
        ...data,
        fileName: `${data.name}.pdf`,
        filePath: `/documents/${data.name}.pdf`,
        fileSize: Math.floor(Math.random() * 1000000) + 100000, 
      };

      const res = await apiRequest("POST", "/api/documents", mockDocument);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DocumentForm) => {
    uploadDocumentMutation.mutate(data);
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "contract":
        return "📄";
      case "certificate":
        return "🏆";
      case "id":
        return "🆔";
      case "insurance":
        return "🛡️";
      default:
        return "📁";
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      contract: "bg-primary text-primary-foreground",
      certificate: "bg-success text-white",
      id: "bg-warning text-white",
      insurance: "bg-destructive text-destructive-foreground",
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || "bg-muted text-muted-foreground"}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  const groupDocumentsByType = () => {
    if (!documents) return {};
    
    return documents.reduce((groups: any, doc: Document) => {
      if (!groups[doc.type]) {
        groups[doc.type] = [];
      }
      groups[doc.type].push(doc);
      return groups;
    }, {});
  };

  const documentGroups = groupDocumentsByType();

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">My Documents</h1>
            <p className="text-muted-foreground">Manage your personal documents and certificates</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-document">
                <Plus className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>Add a new document to your collection</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Document Name</Label>
                  <Input
                    id="name"
                    data-testid="input-document-name"
                    {...form.register("name")}
                    placeholder="Enter document name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="type">Document Type</Label>
                  <Select
                    onValueChange={(value) => form.setValue("type", value)}
                    defaultValue="certificate"
                  >
                    <SelectTrigger data-testid="select-document-type">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="certificate">Certificate</SelectItem>
                      <SelectItem value="id">ID Document</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    data-testid="input-file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Note: File upload is simulated in this demo
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-upload"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploadDocumentMutation.isPending}
                    data-testid="button-submit-upload"
                  >
                    {uploadDocumentMutation.isPending ? "Uploading..." : "Upload Document"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold" data-testid="total-documents">
                    {documents?.length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Folder className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contracts</p>
                  <p className="text-2xl font-bold" data-testid="contracts-count">
                    {documentGroups.contract?.length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <File className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Certificates</p>
                  <p className="text-2xl font-bold" data-testid="certificates-count">
                    {documentGroups.certificate?.length || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <File className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold" data-testid="storage-used">
                    {documents ? 
                      formatFileSize(documents.reduce((total: number, doc: Document) => total + (doc.fileSize || 0), 0)) :
                      "0 MB"
                    }
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Upload className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Folder className="w-5 h-5 mr-2" />
              Document Library
            </CardTitle>
            <CardDescription>All your uploaded documents organized by type</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8" data-testid="loading-documents">
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            ) : documents && documents.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(documentGroups).map(([type, docs]) => (
                  <div key={type}>
                    <h3 className="text-lg font-medium mb-4 flex items-center" data-testid={`section-${type}`}>
                      <span className="text-2xl mr-2">{getDocumentIcon(type)}</span>
                      {type.charAt(0).toUpperCase() + type.slice(1)} Documents
                      <Badge variant="secondary" className="ml-2">
                        {(docs as Document[]).length}
                      </Badge>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(docs as Document[]).map((document: Document) => (
                        <Card key={document.id} className="hover:shadow-md transition-shadow" data-testid={`document-${document.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate" data-testid={`document-name-${document.id}`}>
                                  {document.name}
                                </h4>
                                <p className="text-sm text-muted-foreground" data-testid={`document-filename-${document.id}`}>
                                  {document.fileName}
                                </p>
                              </div>
                              {getTypeBadge(document.type)}
                            </div>
                            
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Size:</span>
                                <span data-testid={`document-size-${document.id}`}>
                                  {formatFileSize(document.fileSize || 0)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Uploaded:</span>
                                <span data-testid={`document-date-${document.id}`}>
                                  {formatDate(document.uploadedAt!)}
                                </span>
                              </div>
                            </div>

                            <div className="flex space-x-2 mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                data-testid={`button-view-${document.id}`}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                data-testid={`button-download-${document.id}`}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-${document.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12" data-testid="no-documents">
                <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No documents uploaded</h3>
                <p className="text-muted-foreground mb-4">
                  Start by uploading your first document to keep all your important files organized
                </p>
                <Button onClick={() => setIsDialogOpen(true)} data-testid="button-upload-first">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Document
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Clock, CheckCircle, PlayCircle, BookOpen, Award } from "lucide-react";
import type { Training, UserTraining } from "@shared/schema";

export default function Training() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trainings, isLoading: trainingsLoading } = useQuery({
    queryKey: ["/api/trainings"],
  });

  const { data: userTrainings, isLoading: userTrainingsLoading } = useQuery({
    queryKey: ["/api/user-trainings"],
  });

  const updateTrainingMutation = useMutation({
    mutationFn: async ({ trainingId, updates }: { trainingId: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/user-trainings/${trainingId}`, updates);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Training updated",
        description: "Your training progress has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-trainings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getTrainingStatus = (trainingId: string) => {
    if (!userTrainings) return null;
    return userTrainings.find((ut: UserTraining) => ut.trainingId === trainingId);
  };

  const handleStartTraining = (trainingId: string) => {
    updateTrainingMutation.mutate({
      trainingId,
      updates: { status: "in_progress", progress: 10 }
    });
  };

  const handleCompleteTraining = (trainingId: string) => {
    updateTrainingMutation.mutate({
      trainingId,
      updates: { status: "completed", progress: 100 }
    });
  };

  const getStatusBadge = (status: string | undefined, isRequired: boolean) => {
    if (!status || status === "not_started") {
      return (
        <Badge variant={isRequired ? "destructive" : "secondary"} data-testid={`status-not-started`}>
          {isRequired ? "Required" : "Not Started"}
        </Badge>
      );
    }
    
    switch (status) {
      case "in_progress":
        return <Badge className="bg-warning text-white" data-testid={`status-in-progress`}>In Progress</Badge>;
      case "completed":
        return <Badge className="bg-success text-white" data-testid={`status-completed`}>Completed</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`status-unknown`}>Unknown</Badge>;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getAvailableTrainings = () => {
    if (!trainings) return [];
    return trainings.filter((training: Training) => {
      const userTraining = getTrainingStatus(training.id);
      return !userTraining || userTraining.status !== "completed";
    });
  };

  const getCompletedTrainings = () => {
    if (!trainings || !userTrainings) return [];
    return trainings.filter((training: Training) => {
      const userTraining = getTrainingStatus(training.id);
      return userTraining && userTraining.status === "completed";
    });
  };

  const getRequiredTrainings = () => {
    if (!trainings) return [];
    return trainings.filter((training: Training) => training.isRequired);
  };

  const getCompletionStats = () => {
    const requiredTrainings = getRequiredTrainings();
    const completedRequired = requiredTrainings.filter(training => {
      const userTraining = getTrainingStatus(training.id);
      return userTraining && userTraining.status === "completed";
    });

    const totalTrainings = trainings?.length || 0;
    const completedTotal = getCompletedTrainings().length;

    return {
      requiredCompleted: completedRequired.length,
      requiredTotal: requiredTrainings.length,
      totalCompleted: completedTotal,
      totalAvailable: totalTrainings,
    };
  };

  const stats = getCompletionStats();

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {}
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Training & Development</h1>
          <p className="text-muted-foreground">Enhance your skills with our training programs</p>
        </div>

        {}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Required Training</p>
                  <p className="text-2xl font-bold" data-testid="required-completion">
                    {stats.requiredCompleted}/{stats.requiredTotal}
                  </p>
                </div>
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <Award className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Completed</p>
                  <p className="text-2xl font-bold" data-testid="total-completed">
                    {stats.totalCompleted}
                  </p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available Courses</p>
                  <p className="text-2xl font-bold" data-testid="available-courses">
                    {getAvailableTrainings().length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold" data-testid="completion-rate">
                    {stats.totalAvailable > 0 ? Math.round((stats.totalCompleted / stats.totalAvailable) * 100) : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList data-testid="training-tabs">
            <TabsTrigger value="available" data-testid="tab-available">
              Available Training
              {getAvailableTrainings().length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getAvailableTrainings().length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed
              {getCompletedTrainings().length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getCompletedTrainings().length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trainingsLoading ? (
                <div className="col-span-full text-center py-8" data-testid="loading-trainings">
                  <p className="text-muted-foreground">Loading training courses...</p>
                </div>
              ) : getAvailableTrainings().length > 0 ? (
                getAvailableTrainings().map((training: Training) => {
                  const userTraining = getTrainingStatus(training.id);
                  const progress = userTraining?.progress || 0;
                  const status = userTraining?.status || "not_started";

                  return (
                    <Card key={training.id} data-testid={`training-${training.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg" data-testid={`training-title-${training.id}`}>
                              {training.title}
                            </CardTitle>
                            <CardDescription className="mt-1" data-testid={`training-description-${training.id}`}>
                              {training.description}
                            </CardDescription>
                          </div>
                          {getStatusBadge(status, training.isRequired!)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span data-testid={`training-duration-${training.id}`}>
                                {formatDuration(training.duration!)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-muted-foreground">Category:</span>
                              <span data-testid={`training-category-${training.id}`}>
                                {training.category}
                              </span>
                            </div>
                          </div>

                          {status === "in_progress" && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span data-testid={`training-progress-${training.id}`}>{progress}%</span>
                              </div>
                              <Progress value={progress} className="w-full" />
                            </div>
                          )}

                          <div className="flex space-x-2">
                            {status === "not_started" && (
                              <Button
                                onClick={() => handleStartTraining(training.id)}
                                disabled={updateTrainingMutation.isPending}
                                className="flex-1"
                                data-testid={`button-start-${training.id}`}
                              >
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Start Training
                              </Button>
                            )}
                            {status === "in_progress" && (
                              <Button
                                onClick={() => handleCompleteTraining(training.id)}
                                disabled={updateTrainingMutation.isPending}
                                className="flex-1"
                                data-testid={`button-complete-${training.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Mark Complete
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-12" data-testid="no-available-trainings">
                  <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No training available</h3>
                  <p className="text-muted-foreground">All training courses have been completed!</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userTrainingsLoading ? (
                <div className="col-span-full text-center py-8" data-testid="loading-completed">
                  <p className="text-muted-foreground">Loading completed training...</p>
                </div>
              ) : getCompletedTrainings().length > 0 ? (
                getCompletedTrainings().map((training: Training) => {
                  const userTraining = getTrainingStatus(training.id);

                  return (
                    <Card key={training.id} data-testid={`completed-training-${training.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg" data-testid={`completed-title-${training.id}`}>
                              {training.title}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {training.description}
                            </CardDescription>
                          </div>
                          <Badge className="bg-success text-white">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{formatDuration(training.duration!)}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {training.category}
                            </span>
                          </div>

                          {userTraining?.completedAt && (
                            <div className="text-sm text-muted-foreground" data-testid={`completed-date-${training.id}`}>
                              Completed on {new Date(userTraining.completedAt).toLocaleDateString()}
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm text-success font-medium">100%</span>
                          </div>
                          <Progress value={100} className="w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-12" data-testid="no-completed-trainings">
                  <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No completed training</h3>
                  <p className="text-muted-foreground">Complete your first training to see it here</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
